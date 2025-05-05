// connectionManager.js
'use strict';

const {Sequelize}  = require('sequelize');
const { LRUCache } = require('lru-cache');
const { cli } = require('winston/lib/winston/config/index.js');
const { loadClientConfigs } = require('./loadClientConfigs.js');
const logger = require('../logger.js');


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
        this.rabbitCache = new LRUCache({
            max: 50, // Cache up to 50 clients (~50-100 MB)
            ttl: 1000 * 60 * 60, // 1 hour expiration
            dispose: (value, key) => {
                console.log(`Evicting RabbitMQ connection for client ${key} from cache`);
            }
        });
    }
    async initializeRABBITMQ(rabbitConfig, clientId) {
        if (!clientId) {
            throw new Error(`Client ID is missing`);
        }
        if (this.rabbitCache.get(clientId)) {
            return;
        }

        if (!rabbitConfig) {
            const clientList = loadClientConfigs();
            rabbitConfig = clientList.find(client => client.ID === clientId)?.RABBITMQ;
            if (!rabbitConfig) {
                throw new Error(`RabbitMQ configuration not found for client ID: ${clientId}`);
            }
        }
         let RABBITMQ_URL = 'amqp://user:password@rabbitmq:5672'
        if (rabbitConfig.HOST && rabbitConfig.PORT && rabbitConfig.USER && rabbitConfig.PASSWORD) {
            RABBITMQ_URL = `amqp://${rabbitConfig.USER}:${rabbitConfig.PASSWORD}@${rabbitConfig.HOST}:${rabbitConfig.PORT}`
        }
        const rabbit = await require('../rabbitMQClient.js')(RABBITMQ_URL);
        logger.info(`[${clientId}] Testing RabbitMQ connection...`);
        await rabbit.connectRabbitMQ();
        logger.info(`[${clientId}] RabbitMQ connection successful.`);
        this.rabbitCache.set(clientId, rabbit);
    }


    /**
     * Initializes Sequelize instance for a client.
     * @param {Object} dbConfig - Database configuration.
     * @param {string} clientId - Client identifier.
     * @returns {Sequelize} - Sequelize instance.
     */
    async initializeSequelize(dbConfig, clientId) {
        if (!clientId) {
            throw new Error(`Client ID is missing`);
        }
        if (this.modelCache.get(clientId)) {
            return;
        }

        if (!dbConfig) {
            const clientList = loadClientConfigs();
            dbConfig = clientList.find(client => client.ID === clientId)?.DBCONFIG;
            if (!dbConfig) {
                throw new Error(`Database configuration not found for client ID: ${clientId}`);
            }
        }

        const sequelize = new Sequelize({
            dialect: 'postgres', // Adjust if using another database
            host: dbConfig.HOST,
            port: dbConfig.PORT,
            database: dbConfig.NAME,
            username: dbConfig.USER,
            password: dbConfig.PASSWORD,
            schema: clientId.toLowerCase(),
            logging: msg => logger.debug(`[${clientId}] Sequelize: ${msg}`),
            pool: {
                max: 5,
                min: 0,
                acquire: 30000,
                idle: 10000,
            },
        });
        logger.info(`[${clientId}] Testing database connection...`);
        sequelize.authenticate()
        logger.info(`[${clientId}] Database connection successful.`);
        let db = await require('../../models')(sequelize, clientId);
        this.modelCache.set(clientId, db);
    }
    async getModels(clientId) {
        let db = this.modelCache.get(clientId);
        if (!db) {
            await this.initializeSequelize(undefined, clientId);
            db = this.modelCache.get(clientId);
            console.log(`Cache stats: size=${this.modelCache.size}, max=${this.modelCache.max}`);
        }
        return db;
    }
  async getRabbitMQ(clientId) {
    let rabbit = this.rabbitCache.get(clientId);
    if (!rabbit) {
        await this.initializeRABBITMQ(undefined, clientId);
        rabbit = this.rabbitCache.get(clientId);
        console.log(`Cache stats: size=${this.rabbitCache.size}, max=${this.rabbitCache.max}`);
    }
    return rabbit;
  }
    async clearCache(clientId) {
        if (clientId) {
            this.modelCache.delete(clientId);
        } else {
            this.modelCache.clear();
        }
    }
   async closeAllTypeConnection(clientId){
        if (clientId) {
            const db = this.modelCache.get(clientId);
            if (db) {
                await db.sequelize.close();
                this.modelCache.delete(clientId);
            }
            const rabbit = this.rabbitCache.get(clientId);
            if (rabbit) {
                await rabbit.closeConnection();
                this.rabbitCache.delete(clientId);
            }
        } else {
            this.modelCache.clear();
            this.rabbitCache.clear();
        }
   }
    async close() {
        this.modelCache.clear();
    }
}

module.exports = new ConnectionManager();