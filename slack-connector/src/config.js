// ./slack-connector/src/config.js
// Load root .env first, then local .env (local overrides root)
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
require('dotenv').config(); // Load local .env potentially overriding root settings

module.exports = {
    env: process.env.NODE_ENV || 'development',
    rabbitMQ: {
        url: process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq:5672', // Use service name 'rabbitmq'
        exchangeName: process.env.RABBITMQ_EXCHANGE_NAME || 'notifications_exchange',
        exchangeType: 'direct',
        queueName: process.env.RABBITMQ_QUEUE_NAME || 'slack_queue',
        bindingKey: process.env.RABBITMQ_BINDING_KEY || 'slack',
        // --- For DLQ/Retries (add later) ---
        // deadLetterExchange: process.env.RABBITMQ_DLX_NAME || 'notifications_dlx',
        // retryDelay: parseInt(process.env.RETRY_DELAY_MS || '30000', 10), // e.g., 30 seconds
    },
    database: {
        host: process.env.DB_HOST || 'postgres', // Use service name 'postgres'
        // Sequelize will pick up user/pass/db from env vars based on config/config.json pattern
        // Need to ensure the connector process has access to these vars
    },
    slack: {
        botToken: process.env.SLACK_BOT_TOKEN, // Ensure this is set in .env or environment
    },
    // Max retry attempts for processing before marking as permanent failure
    maxProcessingAttempts: parseInt(process.env.MAX_PROCESSING_ATTEMPTS || '3', 10)
};