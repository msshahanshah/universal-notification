// connectionManager.js
"use strict";
const rabbitManager = require("./rabbit.js");
const logger = require("./logger");

class ConnectionManager {
  async getRabbitMQ(clientId) {
    logger.info(`ConnectionManager: acquiring RabbitMQ client for clientId=${clientId}`);
    try {
      const rabbit = await rabbitManager.getClient(clientId);
      if (!rabbit) {
        logger.warn(`ConnectionManager: RabbitMQ client is null/undefined for clientId=${clientId}`);
      }
      return rabbit;
    } catch (err) {
      logger.error(`ConnectionManager: failed to get RabbitMQ client for clientId=${clientId}, error: ${JSON.stringify({ error: err.message, stack: err.stack })}`);
      throw err;
    }
  }
}

module.exports = new ConnectionManager();
