"use strict";

const { Sequelize } = require("sequelize");
const { LRUCache } = require("lru-cache");
const logger = require("../logger.js");
const { loadClientConfigs } = require("./loadClientConfigs.js");

/**
 * Custom error for connection-related issues
 */
class ConnectionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ConnectionError";
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
  }

  #validateDbConfig(config) {
    const requiredFields = ["HOST", "PORT", "NAME", "USER", "PASSWORD"];
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
      throw new ConnectionError("Client ID required");
    }

    if (this.modelCache.get(clientId)) {
      return; // Reuse cached models
    }

    try {
      if (!dbConfig) {
        const clientList = await loadClientConfigs();

        dbConfig = clientList.find(
          (client) => client.ID === clientId,
        )?.DBCONFIG;
        if (!dbConfig) {
          throw new ConnectionError(
            `No database config for client ${clientId}`,
          );
        }
      }

      this.#validateDbConfig(dbConfig);

      const sequelize = new Sequelize({
        dialect: process.env.DB_DIALECT || "postgres",
        host: dbConfig.HOST,
        port: dbConfig.PORT,
        database: dbConfig.NAME,
        username: dbConfig.USER,
        password: dbConfig.PASSWORD,
        schema: clientId.toLowerCase(),
        logging: false, // Disable logging for performance
        pool: {
          max: 3, // at most 3 connection can run in parallel
          min: 0, //keep 0 connecton alive when they are alive
          acquire: 10000, //max 10 second time to wait for free connection if not find then throw error
          idle: 5000, //if connection is idle after 5 second it will be closed
        },
      });

      await sequelize.authenticate();
      const db = require("../../models")(sequelize, clientId);
      this.modelCache.set(clientId, db);
    } catch (error) {
      console.log(error);
      throw new ConnectionError(
        `Sequelize init failed for client ${clientId}`,
        { error: error.message },
      );
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
   * Clears cache for a client
   * @param {string} [clientId] - Client identifier
   * @returns {Promise<void>}
   */
  async clearCache(clientId) {
    if (clientId) {
      this.modelCache.delete(clientId);
    } else {
      this.modelCache.clear();
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
      } else {
        await Promise.all([
          ...Array.from(this.modelCache.values()).map((db) =>
            db.sequelize.close(),
          ),
        ]);
        this.modelCache.clear();
      }
    } catch (error) {
      throw new ConnectionError(
        `Failed to close connections for ${clientId || "all"}`,
        { error: error.message },
      );
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
