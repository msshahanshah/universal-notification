'use strict';
const { LRUCache } = require('lru-cache');


const { Sequelize } = require('sequelize');
const { loadClientConfigs } = require('../loadClientConfigs.js');
const logger = require('../../logger.js');

class DatabaseManager {
    constructor() {
        this.modelCache = new LRUCache({
            max: 50,
            ttl: 1000 * 60 * 60, // 1 hour
            dispose: (value, key) => {
                console.log(`Evicting models for client ${key} from cache`);
            },
        });
    }

    async initializeSequelize(dbConfig, clientId) {
        if (this.modelCache.get(clientId)) return;

        if (!dbConfig) {
            const clientList = await loadClientConfigs();
            dbConfig = clientList.find(client => client.ID === clientId)?.DBCONFIG;
            if (!dbConfig) throw new Error(`Database configuration not found for client ID: ${clientId}`);
        }

        const sequelize = new Sequelize({
            dialect: 'postgres',
            host: dbConfig.HOST,
            port: dbConfig.PORT,
            database: dbConfig.NAME,
            username: dbConfig.USER,
            password: dbConfig.PASSWORD,
            schema: clientId.toLowerCase(),
            logging: msg => logger.debug(`[${clientId}] Sequelize: ${msg}`),
            pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
        });

        logger.info(`[${clientId}] Testing database connection...`);
        await sequelize.authenticate();
        logger.info(`[${clientId}] Database connection successful.`);

        const db = await require('../../../models/index.js')(sequelize, Sequelize, clientId);
        this.modelCache.set(clientId, db);
    }

    async getModels(clientId) {
        let db = this.modelCache.get(clientId);
        if (!db) {
            await this.initializeSequelize(undefined, clientId);
            db = this.modelCache.get(clientId);
        }
        return db;
    }

    async close(clientId) {
        const db = this.modelCache.get(clientId);
        if (db) {
            await db.sequelize.close();
            this.modelCache.delete(clientId);
        }
    }

    async closeAll() {
        for (const [clientId, db] of this.modelCache) {
            await db.sequelize.close();
        }
        this.modelCache.clear();
    }

    clearCache(clientId) {
        if (clientId) this.modelCache.delete(clientId);
        else this.modelCache.clear();
    }
}
module.exports = new DatabaseManager();