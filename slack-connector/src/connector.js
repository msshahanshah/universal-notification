const amqp = require("amqplib");
const logger = require("./logger");
const { Sequelize } = require("sequelize");
const rabbitManager = require("./rabbit");
const { sendSlackMessage } = require("./slackSender");

let connection = null;
let channel = null;
let consumerTag = null; // Store consumer tag to allow cancellation
let sequelize = null;

/**
 * Initializes Sequelize instance for a client.
 * @param {Object} dbConfig - Database configuration.
 * @param {string} clientId - Client identifier.
 * @returns {Sequelize} - Sequelize instance.
 */
function initializeSequelize(dbConfig, clientId) {
  return new Sequelize({
    dialect: "postgres",
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
}

/**
 * Establishes a connection to RabbitMQ, asserts the necessary exchange and queue,
 * binds the queue to the exchange, tests the database connection, and starts consuming messages.
 *
 * Also handles connection errors and implements a basic retry mechanism. */
/**
 * Connects to RabbitMQ and starts consuming messages for a client.
 * @param {Object} client - Client configuration.
 */
async function connectAndConsume(client) {
  const clientId = client.ID;
  // get rabbit mq
  try {
    const rabbitClient = await rabbitManager.getClient(clientId);

    const sequelize = initializeSequelize(client.DBCONFIG, clientId);

    await sequelize.authenticate();
    logger.info(`[${clientId}] Database connection successful.`);

    // Define models (assuming models are defined similarly to the original code)
    const database = require("../models")(sequelize, Sequelize, clientId); // Initialize models for this client's Sequelize instance

    // consume rabbitmq
    await rabbitClient.consume({
      service: "slackbot",
      sender: async (payload) => {
        await sendSlackMessage(
          client.SLACKBOT.TOKEN,
          payload.to,
          payload.message,
        );
      },
      db: database,
      maxProcessAttemptCount: 3,
    });
  } catch (error) {
    logger.error(
      `[${clientId}] Failed to connect or consume from RabbitMQ / DB check failed:`,
      { error: error.message, stack: error.stack },
    );
    await closeConnections(clientId, true);
    logger.info(`[${clientId}] Retrying connection in 10 seconds...`);
    setTimeout(() => connectAndConsume(client), 10000);
  }
}

// --- Error Handling, & Shutdown ---
let isShuttingDown = false; // Prevent duplicate shutdown attempts
/**
 * Handles the RabbitMQ connection close event. */
function handleRabbitClose() {
  if (isShuttingDown) return; // Already handling shutdown
  logger.warn("RabbitMQ connection closed.");
  consumerTag = null; // Invalidate consumer tag
  channel = null; // Clear channel and connection
  connection = null;
  // Implement robust reconnection strategy (e.g., exponential backoff)
  logger.info("Attempting RabbitMQ reconnection in 10 seconds...");
  setTimeout(connectAndConsume, 10000); // Simple retry delay
}

/**
 * Closes all open connections (RabbitMQ channel, connection, and database) and performs cleanup.
 *
 * This function is used during shutdown and also during error recovery.
 * It handles cases where connections might already be closed or not yet established.
 *
 * @param {boolean} [attemptReconnect=false] - Whether this is part of a reconnect attempt (true) or final shutdown (false). */

async function closeConnections(clientId, attemptReconnect = false) {
  if (isShuttingDown && !attemptReconnect) return;

  isShuttingDown = !attemptReconnect;
  logger.info(`[${clientId}] Closing connections...`);

  // --- RabbitMQ ---
  try {
    const rabbitClient = await rabbitManager.getClient(clientId);

    if (rabbitClient) {
      logger.info(`[${clientId}] Closing RabbitMQ client...`);
      await rabbitClient.close();
      logger.info(`[${clientId}] RabbitMQ client closed.`);
    }
  } catch (err) {
    logger.error(`[${clientId}] Error closing RabbitMQ client`, {
      errorMessage: err.message,
    });
  }

  // --- Database ---
  if (sequelize) {
    try {
      await sequelize.close();
      logger.info(`[${clientId}] Database connection closed.`);
    } catch (err) {
      logger.error(`[${clientId}] Error closing database connection`, {
        errorMessage: err.message,
      });
    } finally {
      sequelize = null;
    }
  }

  logger.info(`[${clientId}] Connections closed.`);

  if (isShuttingDown) {
    process.exit(0);
  }
}

module.exports = {
  connectAndConsume,
  closeConnections,
};
