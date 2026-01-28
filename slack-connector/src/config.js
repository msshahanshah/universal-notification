// ./slack-connector/src/config.js
/**
 * @fileoverview Configuration file for the Slack connector.
 * This file loads environment variables from .env files and provides a configuration object.
 */

// Load root .env first, then local .env (local overrides root)
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
require('dotenv').config(); // Load local .env potentially overriding root settings

/**
 * Configuration object for the Slack connector.
 * @typedef {Object} SlackConnectorConfig
 * @property {string} env - The environment (e.g., 'development', 'production').
 * @property {Object} rabbitMQ - RabbitMQ connection details.
 * @property {string} rabbitMQ.url - The RabbitMQ server URL.
 * @property {string} rabbitMQ.exchangeName - The name of the RabbitMQ exchange.
 * @property {string} rabbitMQ.exchangeType - The type of the RabbitMQ exchange.
 * @property {string} rabbitMQ.queueName - The name of the RabbitMQ queue.
 * @property {string} rabbitMQ.bindingKey - The binding key for the queue.
 * @property {Object} database - Database connection details.
 * @property {string} database.host - The database host.
 * @property {Object} slack - Slack API details.
 * @property {string} slack.botToken - The Slack bot token.
 * @property {number} maxProcessingAttempts - The maximum number of processing attempts before marking a message as a permanent failure.
 */
module.exports = {
    /** @type {string} */
    env: process.env.NODE_ENV || 'development',
    rabbitMQ: {
        /** @type {string} */
        url: process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq:5672', // Use service name 'rabbitmq'
        /** @type {string} */
        exchangeName: process.env.RABBITMQ_EXCHANGE_NAME || 'notifications_exchange',
        /** @type {string} */
        exchangeType: 'direct',
        /** @type {string} */
        queueName: process.env.RABBITMQ_QUEUE_NAME || 'slack_queue',
        /** @type {string} */
        bindingKey: process.env.RABBITMQ_BINDING_KEY || 'slack',
        // --- For DLQ/Retries (add later) ---
        // deadLetterExchange: process.env.RABBITMQ_DLX_NAME || 'notifications_dlx',
        // retryDelay: parseInt(process.env.RETRY_DELAY_MS || '30000', 10), // e.g., 30 seconds
    },
    database: {
        /** @type {string} */
        host: process.env.DB_HOST || 'postgres', // Use service name 'postgres'
        // Sequelize will pick up user/pass/db from env vars based on config/config.json pattern
        // Need to ensure the connector process has access to these vars
    },
    slack: {
        /** @type {string} */
        botToken: process.env.SLACK_BOT_TOKEN, // Ensure this is set in .env or environment
    },
    // Max retry attempts for processing before marking as permanent failure
    /** @type {number} */
    maxProcessingAttempts: parseInt(process.env.MAX_PROCESSING_ATTEMPTS || '3', 10)
};