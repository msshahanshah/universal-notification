// ./notification-api/src/config.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') }); // Load root .env
const logger = require('./logger'); // Load logger early if needed

module.exports = {
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    rabbitMQ: {
        url: process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq:5672', // Use service name 'rabbitmq' for Docker network
        exchangeName: process.env.RABBITMQ_EXCHANGE_NAME || 'notifications_exchange',
        exchangeType: 'direct',
    },
    // Add database config (read from Sequelize config implicitly or explicitly define here)
    database: {
         // When running node outside docker but connecting to docker pg: 'localhost'
         // When running node inside docker connecting to docker pg: 'postgres' (service name)
        host: process.env.DB_HOST || 'postgres',
        // Other details are usually handled by Sequelize config/env vars
    },
    // Add a base URL for the service if needed for other operations
    // serviceBaseUrl: process.env.SERVICE_BASE_URL || `http://localhost:${process.env.PORT || 3000}`
};

// Log the config being used (excluding sensitive details if necessary)
// logger.info('Configuration Loaded:', { ...module.exports, database: '...', rabbitMQ: '...' }); // Mask sensitive parts if logged