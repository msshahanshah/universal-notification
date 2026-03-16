// connectionManager.js
"use strict";

const { Sequelize } = require("sequelize");
const { LRUCache } = require("lru-cache");
const { loadClientConfigs } = require("./loadClientConfig.js");
const logger = require("../logger.js");
const { WhatsAppSender } = require("./whatsAppSender.js");
const rabbitManager = require("./rabbit.js");

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
    this.whatsAppCache = new LRUCache({
      max: 50, // Cache up to 50 clients (~50-100 MB)
      ttl: 1000 * 60 * 60, // 1 hour expiration
      dispose: (value, key) => {
        console.log(`Evicting whatsapp service for client ${key} from cache`);
      },
    });
  }
  async initializeWhatsAppSender(whatsAppConfig, clientId) {
    if (!clientId) {
      throw new Error(`Client ID is missing`);
    }
    if (this.whatsAppCache.get(clientId)) {
      return;
    }

    if (!whatsAppConfig) {
      const clientList = await loadClientConfigs();
      whatsAppConfig = clientList.find((client) => client.ID === clientId)?.WHATSAPP;
      if (!whatsAppConfig) {
        throw new Error(
          `WhatsApp configuration not found for client ID: ${clientId}`,
        );
      }
    }
    logger.debug(`[${clientId}] WhatsApp config:`, {
      provider: whatsAppConfig.TWILIOx
        ? "TWILIO" : "Other",
    });
    logger.info(`[${clientId}] Testing whatsApp service connection...`);
    let whatsAppSender = new WhatsAppSender(clientId, whatsAppConfig);
    await whatsAppSender.initialize();
    logger.info(`[${clientId}] WhatsApp service connection successful.`);
    this.whatsAppCache.set(clientId, whatsAppSender);
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
      const clientList = await loadClientConfigs();
      dbConfig = clientList.find((client) => client.ID === clientId)?.DBCONFIG;
      if (!dbConfig) {
        throw new Error(
          `Database configuration not found for client ID: ${clientId}`,
        );
      }
    }

    const sequelize = new Sequelize({
      dialect: "postgres", // Adjust if using another database
      host: dbConfig.HOST,
      port: dbConfig.PORT,
      database: dbConfig.NAME,
      username: dbConfig.USER,
      password: dbConfig.PASSWORD,
      schema: clientId.toLowerCase(),
      logging: (msg) => logger.debug(`[${clientId}] Sequelize: ${msg}`),
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    });
    logger.info(`[${clientId}] Testing database connection...`);
    await sequelize.authenticate();
    logger.info(`[${clientId}] Database connection successful.`);
    let db = await require("../../models")(sequelize, Sequelize, clientId);
    this.modelCache.set(clientId, db);
    return Promise.resolve();
  }
  async getModels(clientId) {
    let db = this.modelCache.get(clientId);
    if (!db) {
      await this.initializeSequelize(undefined, clientId);
      db = this.modelCache.get(clientId);
      logger.debug(
        `Cache stats: size=${this.modelCache.size}, max=${this.modelCache.max}`,
      );
    }
    return db;
  }
  async getRabbitMQ(clientId) {
    let rabbit = await rabbitManager.getClient(clientId);
    return rabbit;
  }
  async getWhatsAppSender(clientId) {
    let whatsAppSender = this.whatsAppCache.get(clientId);
    if (!whatsAppSender) {
      await this.initializeWhatsAppSender(undefined, clientId);
      whatsAppSender = this.whatsAppCache.get(clientId);
      logger.debug(
        `WhatsApp cache stats: size=${this.whatsAppCache.size}, max=${this.whatsAppCache.max}`,
      );
    }
    return whatsAppSender;
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
        await rabbitManager.close(clientId);
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
