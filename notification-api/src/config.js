// ./notification-api/src/config.js
/**
 * @fileoverview Configuration file for the notification-api service.
 * This file loads environment variables from the .env file and defines 
 * the configuration for the application.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') }); // Load root .env
const logger = require('./logger'); // Load logger early if needed

/**
 * Configuration object for the application.
 * @type {Object}
 * @property {string} env - The environment the application is running in (e.g., 'development', 'production').
 * @property {number} port - The port the application should listen on.
 * @property {Object} rabbitMQ - Configuration for RabbitMQ.
 * @property {string} rabbitMQ.url - The URL for connecting to RabbitMQ.
 * @property {string} rabbitMQ.exchangeName - The name of the exchange to use in RabbitMQ.
 * @property {string} rabbitMQ.exchangeType - The type of exchange to use in RabbitMQ.
 * @property {Object} database - Configuration for the database.
 * @property {string} database.host - The host address of the database.
 */


module.exports = {
    env: process.env.NODE_ENV || 'development', 
    port: process.env.PORT || 3000,
    rabbitMQ: {
        url: process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq:5672', // Use service name 'rabbitmq' for Docker network
        exchangeName: process.env.RABBITMQ_EXCHANGE_NAME || 'notifications_exchange',
        exchangeType: 'direct',
        // Email queue configuration
        emailQueueName: process.env.RABBITMQ_EMAIL_QUEUE_NAME || 'email_queue',
        emailBindingKey: process.env.RABBITMQ_EMAIL_BINDING_KEY || 'email',
        emailExchangeName: process.env.RABBITMQ_EXCHANGE_NAME_EMAIL || 'notifications_exchange_email'
    },
    // Add database config (read from Sequelize config implicitly or explicitly define here)
     /**
     * Database configuration.
     * @property {string} host - Database host address. 
     *   - When running outside docker but connecting to docker pg: 'localhost'
     *   - When running inside docker connecting to docker pg: 'postgres' (service name)
     */
      database: {
        host: process.env.DB_HOST || 'postgres',
    
    },

};

