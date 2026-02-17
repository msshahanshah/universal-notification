const amqp = require('amqplib');
const logger = require('./logger');

/**
 * Custom error for RabbitMQ issues
 */
class RabbitMQError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'RabbitMQError';
        this.details = details;
    }
}

/**
 * RabbitMQ Client Factory
 * @param {Object} config - RabbitMQ configuration
 * @param {string} config.url - Connection URL
 * @param {Object} config.exchange - Exchange config
 * @param {string} config.exchange.name - Exchange name
 * @param {string} config.exchange.type - Exchange type
 * @param {boolean} [config.exchange.durable=true] - Exchange durability
 * @param {Array<Object>} [config.services] - Service configurations
 * @returns {Object} RabbitMQ client instance
 */
module.exports = (config) => {
    let connection = null;
    let channel = null;
    let isConnecting = false;
    const reconnectAttempts = 3;
    const baseReconnectDelay = 2000;

    /**
     * Validates configuration
     * @private
     */
    function validateConfig() {
        if (!config.url || !config.exchange?.name || !config.exchange?.type) {
            throw new RabbitMQError('Invalid config: url, exchange.name, and exchange.type required');
        }
    }

    /**
     * Calculates reconnect delay with exponential backoff
     * @param {number} attempt - Current attempt
     * @returns {number} Delay in ms
     * @private
     */
    function getReconnectDelay(attempt) {
        return Math.min(baseReconnectDelay * Math.pow(1.5, attempt), 10000);
    }

    /**
     * Establishes RabbitMQ connection
     * @returns {Promise<{connection: Object, channel: Object}>}
     */
    async function connectRabbitMQ() {
        if (channel && connection) {
            return { connection, channel };
        }

        if (isConnecting) {
            while (isConnecting) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            return { connection, channel };
        }

        validateConfig();
        isConnecting = true;

        try {
            const url = config.url || process.env.RABBITMQ_URL;
            connection = await amqp.connect(url, { heartbeat: 30, timeout: 5000 });
            channel = await connection.createConfirmChannel();

            // Assert exchange
            await channel.assertExchange(
                config.exchange.name,
                config.exchange.type,
                { durable: true }
            );

            // Setup service queues if provided
            if (config.services) {
                for (const service of config.services) {
                    await channel.assertQueue(service.QUEUE_NAME, { durable: true });
                    await channel.bindQueue(
                        service.QUEUE_NAME,
                        config.exchange.name,
                        service.ROUTING_KEY
                    );
                }
            }

            connection.on('error', (err) => {
                logger.error('RabbitMQ connection error', { error: err.message });
                connection = null;
                channel = null;
            });

            connection.on('close', () => {
                logger.warn('RabbitMQ connection closed');
                connection = null;
                channel = null;
                setTimeout(() => attemptReconnect(0), baseReconnectDelay);
            });

            return { connection, channel };
        } catch (error) {
            throw new RabbitMQError('Connection failed', { error: error.message });
        } finally {
            isConnecting = false;
        }
    }

    /**
     * Attempts reconnection with backoff
     * @param {number} attempt - Current attempt
     * @private
     */
    async function attemptReconnect(attempt) {
        if (attempt >= reconnectAttempts) {
            logger.error('Max reconnection attempts reached');
            return;
        }

        try {
            await connectRabbitMQ();
        } catch (error) {
            const delay = getReconnectDelay(attempt);
            logger.warn(`Reconnect attempt ${attempt + 1} failed, retrying in ${delay}ms`);
            setTimeout(() => attemptReconnect(attempt + 1), delay);
        }
    }

    /**
     * Publishes a message to the exchange
     * @param {string} serviceType - Service type (e.g., 'email', 'sms', 'slack')
     * @param {Object} message - Message to publish
     * @returns {Promise<boolean>} Success status
     */
    async function publishMessage(serviceType, message) {
        if (!channel) {
            await connectRabbitMQ();
        }

        try {
            // Find routing key from services config
            const service = config.services?.find(s => s.ROUTING_KEY === serviceType);
            if (!service) {
                throw new RabbitMQError(`No service found for routing key: ${serviceType}`);
            }

            const success = channel.publish(
                config.exchange.name,
                // config.services.exchange.name,
                // "notifications_exchange",
                service.ROUTING_KEY,
                Buffer.from(JSON.stringify(message)),
                { persistent: true }
            );

            await channel.waitForConfirms();
            return success;
        } catch (error) {
            console.log(error);
            throw new RabbitMQError('Message publishing failed', {
                error: error.message,
                serviceType,
                messageId: message.messageId,
            });
        }
    }

    /**
     * Closes RabbitMQ connection
     * @returns {Promise<void>}
     */
    async function closeConnection() {
        try {
            if (channel) {
                await channel.close();
                channel = null;
            }
            if (connection) {
                await connection.close();
                connection = null;
            }
        } catch (error) {
            throw new RabbitMQError('Connection closure failed', { error: error.message });
        }
    }

    return {
        connectRabbitMQ,
        publishMessage,
        closeConnection,
        getChannel: () => channel,
    };
};