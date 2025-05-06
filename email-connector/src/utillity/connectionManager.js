// connectionManager.js
'use strict';

const { Sequelize } = require('sequelize');
const { LRUCache } = require('lru-cache');
const { cli } = require('winston/lib/winston/config/index.js');
const { loadClientConfigs } = require('./loadClientConfigs.js');
const logger = require('../logger.js');
const {EmailSender} =require('./emailSender.js')

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
        this.emailCache = new LRUCache({
            max: 50, // Cache up to 50 clients (~50-100 MB)
            ttl: 1000 * 60 * 60, // 1 hour expiration
            dispose: (value, key) => {
                console.log(`Evicting email service for client ${key} from cache`);
            }
        });
    }
    async initializeEmailSender(emailConfig, clientId) {
        if (!clientId) {
            throw new Error(`Client ID is missing`);
        }
        if (this.emailCache.get(clientId)) {
            return;
        }

        if (!emailConfig) {
            const clientList =await loadClientConfigs();
            emailConfig = clientList.find(client => client.ID === clientId)?.EMAIL;
            if (!emailConfig) {
                throw new Error(`Email configuration not found for client ID: ${clientId}`);
            }
        }
       (emailConfig);
        logger.info(`[${clientId}] Testing email service connection...`);
        let emailSender= new EmailSender(emailConfig);
        await emailSender.initialize();
        logger.info(`[${clientId}] Email service connection successful.`);
        this.emailCache.set(clientId, emailSender);
    }
    async initializeRABBITMQ(rabbitConfig, clientId) {
        if (!clientId) {
            throw new Error(`Client ID is missing`);
        }
        if (this.rabbitCache.get(clientId)) {
            return;
        }

        if (!rabbitConfig) {
            const clientList =await loadClientConfigs();
            rabbitConfig = clientList.find(client => client.ID === clientId)?.RABBITMQ;
            if (!rabbitConfig) {
                throw new Error(`RabbitMQ configuration not found for client ID: ${clientId}`);
            }
        }
        let RABBITMQ_URL = 'amqp://user:password@rabbitmq:5672'
        if (rabbitConfig.HOST && rabbitConfig.PORT && rabbitConfig.USER && rabbitConfig.PASSWORD) {
            RABBITMQ_URL = `amqp://${rabbitConfig.USER}:${rabbitConfig.PASSWORD}@${rabbitConfig.HOST}:${rabbitConfig.PORT}`
        }
        const rabbit = await require('../rabbitMQClient.js')(RABBITMQ_URL,rabbitConfig);
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
            const clientList =await loadClientConfigs();
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
        let db = await require('../../models')(sequelize,Sequelize, clientId);
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
    async getEmailSender(clientId) {
        let emailSender = this.emailCache.get(clientId);
        if (!emailSender) {
            await this.initializeEmailSender(undefined, clientId);
            emailSender = this.emailCache.get(clientId);
            console.log(`Cache stats: size=${this.emailCache.size}, max=${this.emailCache.max}`);
        }
        return emailSender;
    }
    async clearCache(clientId) {
        if (clientId) {
            this.modelCache.delete(clientId);
        } else {
            this.modelCache.clear();
        }
    }
    async closeAllTypeConnection(clientId) {
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