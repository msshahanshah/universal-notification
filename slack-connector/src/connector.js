// ./slack-connector/src/connector.js
const amqp = require('amqplib');
// const config = require('./config');
const logger = require('./logger');
const { Sequelize } = require('sequelize');


// const db = require('../models'); // Import Sequelize models/connection
// const Notification = db.Notification; // Get the Notification model
// const { Op } = require("sequelize"); // Import Operators if needed for queries

let connection = null;
let channel = null;
let consumerTag = null;// Store consumer tag to allow cancellation
let sequelize = null;

/**
 * Initializes Sequelize instance for a client.
 * @param {Object} dbConfig - Database configuration.
 * @param {string} clientId - Client identifier.
 * @returns {Sequelize} - Sequelize instance.
 */
function initializeSequelize(dbConfig, clientId) {
    return new Sequelize({
        dialect: 'postgres',
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
    try {
        logger.info(`[${clientId}] Connecting to RabbitMQ...`);
        const rabbitMQUrl = process.env.RABBITMQ_URL || `amqp://${client.RABBITMQ.USER}:${client.RABBITMQ.PASSWORD}@${client.RABBITMQ.HOST}:${client.RABBITMQ.PORT}`;
        connection = await amqp.connect(rabbitMQUrl);
        channel = await connection.createChannel();
        logger.info(`[${clientId}] RabbitMQ connected.`);

        connection.on('error', err => handleRabbitError(err, clientId));
        connection.on('close', () => handleRabbitClose(clientId));

        await channel.assertExchange(
            client.SLACKBOT.RABBITMQ.EXCHANGE_NAME,
            client.SLACKBOT.RABBITMQ.EXCHANGE_TYPE,
            { durable: true }
        );
        logger.info(`[${clientId}] Exchange '${client.SLACKBOT.RABBITMQ.EXCHANGE_NAME}' asserted.`);

        const queueArgs = { durable: true };
        const q = await channel.assertQueue(client.SLACKBOT.RABBITMQ.QUEUE_NAME, queueArgs);
        logger.info(`[${clientId}] Queue '${q.queue}' asserted.`);

        await channel.bindQueue(q.queue, client.SLACKBOT.RABBITMQ.EXCHANGE_NAME, client.SLACKBOT.RABBITMQ.ROUTING_KEY);
        logger.info(`[${clientId}] Queue '${q.queue}' bound to exchange '${client.SLACKBOT.RABBITMQ.EXCHANGE_NAME}' with key '${client.SLACKBOT.RABBITMQ.ROUTING_KEY}'.`);

        logger.info(`[${clientId}] Testing database connection...`);
        sequelize = initializeSequelize(client.DBCONFIG, clientId);
        await sequelize.authenticate();
        logger.info(`[${clientId}] Database connection successful.`);

        // Define models (assuming models are defined similarly to the original code)
        const database=require('../models')(sequelize,Sequelize); // Initialize models for this client's Sequelize instance
        const processMessage = require('./rabbitMQClient')(database);
        channel.prefetch(1);
        logger.info(`[${clientId}] Waiting for messages in queue '${q.queue}'.`);

        const consumeResult = await channel.consume(q.queue, (msg) => processMessage(client.SLACKBOT.TOKEN,msg, channel, client), { noAck: false });
        consumerTag = consumeResult.consumerTag;
        logger.info(`[${clientId}] Consumer started with tag: ${consumerTag}`);
    } catch (error) {
        logger.error(`[${clientId}] Failed to connect or consume from RabbitMQ / DB check failed:`, { error: error.message, stack: error.stack });
        await closeConnections(clientId, true);
        logger.info(`[${clientId}] Retrying connection in 10 seconds...`);
        setTimeout(() => connectAndConsume(client), 10000);
    }
}

// --- Connection Handling, Error Handling, & Shutdown ---

let isShuttingDown = false; // Prevent duplicate shutdown attempts

/**
 * Handles RabbitMQ connection errors.
 *
 * Logs the error and relies on the 'close' event handler for reconnection.
 * @param {Error} err - The error object. */
function handleRabbitError(err) {
    logger.error('RabbitMQ connection error:', { errorMessage: err.message, stack: err.stack });
    // Connection is likely closed already or will be soon. The 'close' handler will attempt reconnection.
    // No need to call closeConnections here, may interfere with close handler.
}

/**
 * Handles the RabbitMQ connection close event. */
function handleRabbitClose() {
    if (isShuttingDown) return; // Already handling shutdown
    logger.warn('RabbitMQ connection closed.');
    consumerTag = null; // Invalidate consumer tag
    channel = null; // Clear channel and connection
    connection = null;
    // Implement robust reconnection strategy (e.g., exponential backoff)
    logger.info('Attempting RabbitMQ reconnection in 10 seconds...');
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

    if (channel && consumerTag) {
        try {
            logger.info(`[${clientId}] Cancelling consumer: ${consumerTag}`);
            await channel.cancel(consumerTag);
            logger.info(`[${clientId}] Consumer cancelled.`);
        } catch (err) {
            logger.error(`[${clientId}] Error cancelling consumer:`, { errorMessage: err.message });
        }
        consumerTag = null;
    }

    if (channel) {
        try {
            await channel.close();
            logger.info(`[${clientId}] RabbitMQ channel closed.`);
        } catch (err) {
            logger.error(`[${clientId}] Error closing RabbitMQ channel:`, { errorMessage: err.message });
        }
        channel = null;
    }

    if (connection) {
        try {
            connection.off('error', handleRabbitError);
            connection.off('close', handleRabbitClose);
            await connection.close();
            logger.info(`[${clientId}] RabbitMQ connection closed.`);
        } catch (err) {
            logger.error(`[${clientId}] Error closing RabbitMQ connection:`, { errorMessage: err.message });
        }
        connection = null;
    }

    if (sequelize) {
        try {
            await sequelize.close();
            logger.info(`[${clientId}] Database connection closed.`);
        } catch (err) {
            logger.error(`[${clientId}] Error closing database connection:`, { errorMessage: err.message });
        }
        sequelize = null;
    }

    logger.info(`[${clientId}] Connections closed.`);
    if (isShuttingDown) {
        process.exit(0);
    }
}

module.exports = { 
    connectAndConsume,
    closeConnections
};
// ----------------------------------------------------