// connectionManager.js
'use strict';

const { Sequelize } = require('sequelize');
const {LRUCache} = require('lru-cache');
const { cli } = require('winston/lib/winston/config/index.js');
const { loadClientConfigs } = require('./loadClientConfigs.js');


class ConnectionManager {
    constructor() {
        // LRU cache for client-specific models
        this.modelCache = new LRUCache({
            max: 50, // Cache up to 50 clients (~50-100 MB)
            ttl: 1000 * 60 * 60, // 1 hour expiration
            dispose: (value, key) => {
                console.log(`Evicting models for client ${key} from cache`);
            },
        });
    }
    /**
     * Initializes Sequelize instance for a client.
     * @param {Object} dbConfig - Database configuration.
     * @param {string} clientId - Client identifier.
     * @returns {Sequelize} - Sequelize instance.
     */
    async initializeSequelize(dbConfig, clientId) {
        if(!clientId){
            throw new Error(`Client ID is missing`);
        }  
        if(this.modelCache.get(clientId)){
            return;
        }
        
        if (!dbConfig) {
            const clientList=loadClientConfigs();
            dbConfig = clientList.find(client => client.ID === clientId)?.DBCONFIG;
            if (!dbConfig) {
                throw new Error(`Database configuration not found for client ID: ${clientId}`);
            }
        }
        
       const sequelize= new Sequelize({
            dialect: 'postgres', // Adjust if using another database
            host: dbConfig.HOST,
            port: dbConfig.PORT,
            database: dbConfig.NAME,
            username: dbConfig.USER,
            password: dbConfig.PASSWORD,
            logging: msg => logger.debug(`[${clientId}] Sequelize: ${msg}`),
            pool: {
                max: 5,
                min: 0,
                acquire: 30000,
                idle: 10000,
            },
        });
        let db=await require('./models')(sequelize);
        this.modelCache.set(clientId, db);
    }
    async getModels(clientId) {
        let db = this.modelCache.get(clientId);
        if (!db) {
            await this.initializeSequelize(undefined,clientId); 
            db = this.modelCache.get(clientId);
            console.log(`Cache stats: size=${this.modelCache.size}, max=${this.modelCache.max}`);
        }
        return db;
    }

    async clearCache(clientId) {
        if (clientId) {
            this.modelCache.delete(clientId);
        } else {
            this.modelCache.clear();
        }
    }

    async close() {
        await this.sequelize.close();
        this.modelCache.clear();
    }
}

module.exports = new ConnectionManager();