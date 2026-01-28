// ./email-connector/src/config.js
/**
 * @fileoverview Configuration file for the Email connector.
 * This file loads environment variables from .env files and provides a configuration object.
 */

// Load root .env first, then local .env (local overrides root)
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
require('dotenv').config(); // Load local .env potentially overriding root settings

/**
 * Configuration object for the Email connector.
 * @typedef {Object} EmailConnectorConfig
 * @property {string} env - The environment (e.g., 'development', 'production').
 * @property {Object} rabbitMQ - RabbitMQ connection details.
 * @property {string} rabbitMQ.url - The RabbitMQ server URL.
 * @property {string} rabbitMQ.exchangeName - The name of the RabbitMQ exchange.
 * @property {string} rabbitMQ.exchangeType - The type of the RabbitMQ exchange.
 * @property {string} rabbitMQ.queueName - The name of the RabbitMQ queue.
 * @property {string} rabbitMQ.bindingKey - The binding key for the queue.
 * @property {Object} aws - AWS configuration details.
 * @property {string} aws.region - The AWS region.
 * @property {string} aws.s3Bucket - The name of the S3 bucket for email templates.
 * @property {string} aws.accessKeyId - The AWS Access Key ID.
 * @property {string} aws.secretAccessKey - The AWS Secret Access Key.
 * @property {string} aws.sesFromEmail - The email used to send the emails.
 * @property {string} aws.s3BucketName - The name of the S3 bucket for email templates.

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
        queueName: process.env.RABBITMQ_QUEUE_NAME_EMAIL || 'email_queue',
        /** @type {string} */
        bindingKey: process.env.RABBITMQ_BINDING_KEY_EMAIL || 'email',
    },
    aws: {
        /** @type {string} */
        region: process.env.AWS_REGION || 'us-east-1', // Default region
        /** @type {string} */
        s3BucketName: process.env.AWS_S3_BUCKET || 'email-templates', // Default bucket name
        /** @type {string} */
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        /** @type {string} */
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        /** @type {string} */
        sesFromEmail: process.env.AWS_SES_FROM_EMAIL,
    },
    // Max retry attempts for processing before marking as permanent failure
    /** @type {number} */
    maxProcessingAttempts: parseInt(process.env.MAX_PROCESSING_ATTEMPTS || '3', 10)
};