'use strict';

const {Sequelize}  = require('sequelize');
const { LRUCache } = require('lru-cache');
const { loadClientConfigs } = require('./loadClientConfigs.js');
const logger = require('../logger.js');

/**
 * Custom error for connection-related issues
 */
class ConnectionError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'ConnectionError';
        this.details = details;
    }
}

/**
 * Manages database and RabbitMQ connections with memory-efficient caching
 */
class ConnectionManager {
    /**
     * @param {Object} [options] - Configuration options
     * @param {number} [options.cacheMax=25] - Maximum cache size (reduced for memory)
     * @param {number} [options.cacheTtl=1800000] - Cache TTL in ms (30 minutes)
     */
    constructor(options = {}) {
        const { cacheMax = 25, cacheTtl = 1000 * 60 * 30 } = options;
        
        // Initialize LRU caches with smaller footprint
        this.modelCache = new LRUCache({
            max: cacheMax,
            ttl: cacheTtl,
            dispose: (value, key) => {
                logger.debug(`Evicting database models for client ${key}`);
            },
        });

        this.rabbitCache = new LRUCache({
            max: cacheMax,
            ttl: cacheTtl,
            dispose: (value, key) => {
                logger.debug(`Evicting RabbitMQ connection for client ${key}`);
            },
        });
    }

    /**
     * Validates RabbitMQ configuration
     * @param {Object} config - RabbitMQ configuration
     * @private
     */
    #validateRabbitConfig(config) {
        const requiredFields = ['HOST', 'PORT', 'USER', 'PASSWORD', 'EXCHANGE_NAME', 'EXCHANGE_TYPE'];
        for (const field of requiredFields) {
            if (!config[field]) {
                throw new ConnectionError(`Missing RabbitMQ config: ${field}`);
            }
        }
    }

    /**
     * Initializes RabbitMQ connection
     * @param {Object} [rabbitConfig] - RabbitMQ configuration
     * @param {string} clientId - Client identifier
     * @returns {Promise<void>}
     */
    async initializeRabbitMQ(rabbitConfig, clientId) {
        if (!clientId) {
            throw new ConnectionError('Client ID required');
        }

        if (this.rabbitCache.get(clientId)) {
            const rabbit = this.rabbitCache.get(clientId);
            if (rabbit.getChannel()) {
                return; // Reuse healthy connection
            }
            this.rabbitCache.delete(clientId); // Clear stale connection
        }

        try {
            if (!rabbitConfig) {
                const clientList = await loadClientConfigs();
                rabbitConfig = clientList.find(client => client.ID === clientId)?.RABBITMQ;
                if (!rabbitConfig) {
                    throw new ConnectionError(`No RabbitMQ config for client ${clientId}`);
                }
            }

            this.#validateRabbitConfig(rabbitConfig);

            const RABBITMQ_URL =`amqp://${rabbitConfig.USER}:${rabbitConfig.PASSWORD}@${rabbitConfig.HOST}:${rabbitConfig.PORT}`||process.env.RABBITMQ_URL;

            const rabbit = await require('../rabbitMQClient.js')({
                url: RABBITMQ_URL,
                exchange: {
                    name: rabbitConfig.EXCHANGE_NAME,
                    type: rabbitConfig.EXCHANGE_TYPE,
                    durable: true,
                },
                services: rabbitConfig.SERVERICES,
            });

            await rabbit.connectRabbitMQ();
            logger.debug(`[${clientId}] RabbitMQ connection established`);
            this.rabbitCache.set(clientId, rabbit);
        } catch (error) {
            throw new ConnectionError(`RabbitMQ init failed for client ${clientId}`, { error: error.message });
        }
    }

    /**
     * Validates database configuration
     * @param {Object} config - Database configuration
     * @private
     */
    #validateDbConfig(config) {
        const requiredFields = ['HOST', 'PORT', 'NAME', 'USER', 'PASSWORD'];
        for (const field of requiredFields) {
            if (!config[field]) {
                throw new ConnectionError(`Missing database config: ${field}`);
            }
        }
    }

    /**
     * Initializes Sequelize instance
     * @param {Object} [dbConfig] - Database configuration
     * @param {string} clientId - Client identifier
     * @returns {Promise<void>}
     */
    async initializeSequelize(dbConfig, clientId) {
        if (!clientId) {
            throw new ConnectionError('Client ID required');
        }

        if (this.modelCache.get(clientId)) {
            return; // Reuse cached models
        }

        try {
            if (!dbConfig) {
                const clientList = await loadClientConfigs();
                dbConfig = clientList.find(client => client.ID === clientId)?.DBCONFIG;
                if (!dbConfig) {
                    throw new ConnectionError(`No database config for client ${clientId}`);
                }
            }

            this.#validateDbConfig(dbConfig);

            const sequelize = new Sequelize({
                dialect: process.env.DB_DIALECT || 'postgres',
                host: dbConfig.HOST,
                port: dbConfig.PORT,
                database: dbConfig.NAME,
                username: dbConfig.USER,
                password: dbConfig.PASSWORD,
                schema: clientId.toLowerCase(),
                logging: false, // Disable logging for performance
                pool: {
                    max: 3, // Reduced for memory efficiency
                    min: 0,
                    acquire: 10000,
                    idle: 5000,
                },
            });

            await sequelize.authenticate();
            const db = await require('../../models')(sequelize, clientId);
            this.modelCache.set(clientId, db);
        } catch (error) {
            throw new ConnectionError(`Sequelize init failed for client ${clientId}`, { error: error.message });
        }
    }

    /**
     * Gets cached database models
     * @param {string} clientId - Client identifier
     * @returns {Promise<Object>} Database models
     */
    async getModels(clientId) {
        let db = this.modelCache.get(clientId);
        if (!db) {
            await this.initializeSequelize(undefined, clientId);
            db = this.modelCache.get(clientId);
        }
        return db;
    }

    /**
     * Gets cached RabbitMQ connection
     * @param {string} clientId - Client identifier
     * @returns {Promise<Object>} RabbitMQ connection
     */
    async getRabbitMQ(clientId) {
        let rabbit = this.rabbitCache.get(clientId);
        if (!rabbit || !rabbit.getChannel()) {
            await this.initializeRabbitMQ(undefined, clientId);
            rabbit = this.rabbitCache.get(clientId);
        }
        return rabbit;
    }

    /**
     * Clears cache for a client
     * @param {string} [clientId] - Client identifier
     * @returns {Promise<void>}
     */
    async clearCache(clientId) {
        if (clientId) {
            this.modelCache.delete(clientId);
            this.rabbitCache.delete(clientId);
        } else {
            this.modelCache.clear();
            this.rabbitCache.clear();
        }
    }

    /**
     * Closes all connections for a client
     * @param {string} [clientId] - Client identifier
     * @returns {Promise<void>}
     */
    async closeAllConnections(clientId) {
        try {
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
                await Promise.all([
                    ...Array.from(this.modelCache.values()).map(db => db.sequelize.close()),
                    ...Array.from(this.rabbitCache.values()).map(rabbit => rabbit.closeConnection()),
                ]);
                this.modelCache.clear();
                this.rabbitCache.clear();
            }
        } catch (error) {
            throw new ConnectionError(`Failed to close connections for ${clientId || 'all'}`, { error: error.message });
        }
    }

    /**
     * Closes all connections and clears caches
     * @returns {Promise<void>}
     */
    async close() {
        await this.closeAllConnections();
    }
}

module.exports = new ConnectionManager();