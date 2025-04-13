// ./notification-api/src/rabbitMQClient.js
const amqp = require('amqplib');
const config = require('./config');

let connection = null;
let channel = null;

/**
 * Establishes a connection to RabbitMQ and creates a channel.
 * Also asserts the existence of the configured exchange.
 *
 * @returns {Promise<{connection: object, channel: object}>} An object containing the connection and channel.
 * @throws {Error} If there is a failure connecting to RabbitMQ.
 */
async function connectRabbitMQ() {
    if (channel) {
        return { connection, channel };
    }


    console.log('Connecting to RabbitMQ...');
    try {
        connection = await amqp.connect(config.rabbitMQ.url);
        channel = await connection.createChannel();

        // Assert the exchange exists
        await channel.assertExchange(
            config.rabbitMQ.exchangeName,
            config.rabbitMQ.exchangeType,
            { durable: true } // Make exchange survive broker restart
        );

        console.log('RabbitMQ connected and exchange asserted.');

        connection.on('error', (err) => {
            console.error('RabbitMQ connection error:', err.message);
            // Implement reconnection logic if needed
            connection = null;
            channel = null;
            // setTimeout(connectRabbitMQ, 5000); // Basic retry
        });
        connection.on('close', () => {
            console.warn('RabbitMQ connection closed. Attempting to reconnect...');
            connection = null;
            channel = null;
            // setTimeout(connectRabbitMQ, 5000); // Basic retry
        });

        return { connection, channel };
    } catch (error) {
        console.error('Failed to connect to RabbitMQ:', error.message);
        // Implement retry logic
        // setTimeout(connectRabbitMQ, 5000); // Basic retry
        throw error; // Re-throw for initial connection failure
    }
}

/**
 * Publishes a message to the specified exchange with the given routing key.
 *
 * @param {string} routingKey - The routing key for the message.
 * @param {object} message - The message to be published.
 * @throws {Error} If the channel is not available or if publishing fails.
 */
async function publishMessage(routingKey, message) {
    if (!channel) {
        console.error('Cannot publish message: RabbitMQ channel not available.');
        // Optionally try to reconnect here or throw error
        await connectRabbitMQ(); // Try to reconnect
        if (!channel) {
             throw new Error('RabbitMQ channel not available after attempting reconnect.');
        }
    }

    try {
        console.log(`Publishing message to exchange '${config.rabbitMQ.exchangeName}' with routing key '${routingKey}'`);
        // Publish the message to the exchange with the routing key
        channel.publish(
            config.rabbitMQ.exchangeName,
            routingKey,
            Buffer.from(JSON.stringify(message)),
            {
                persistent: true, // Make message survive broker restart
            }
        );
        console.log('Message published successfully.');
    } catch (error) {
        console.error('Failed to publish message:', error);
        // Handle potential connection issues during publish if necessary
        throw error;
    }
}

/**
 * Closes the RabbitMQ channel and connection.
 *
 */
async function closeConnection() {
    if (channel) {
        await channel.close();
        channel = null;
        console.log('RabbitMQ channel closed.');
    }
     if (connection) {
        await connection.close();
        connection = null;
        console.log('RabbitMQ connection closed.');
    }
}

/**
 * @module rabbitMQClient
 * @description This module provides functions to connect to RabbitMQ, publish messages, and close the connection.
 */

module.exports = {
    connectRabbitMQ,
    publishMessage,
    closeConnection,
    /** @returns {object} current channel*/
    getChannel: () => channel,
};
