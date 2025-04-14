// ./email-connector/src/connector.js
'use strict';

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const amqp = require('amqplib');
const AWS = require('aws-sdk');
const Handlebars = require('handlebars');
const config = require('./config');
const logger = require('./logger');

let db = null; // Initialize db to null, it will be initialized later
// const Notification = db.Notification;  // remove this line

const { Op } = require("sequelize");

/**
 * @module emailConnector
 * @description This module provides functions to connect to RabbitMQ, consume messages for sending emails,
 *              retrieve email templates from S3, render them with Handlebars, send emails via AWS SES,
 *              and update the database with the status of each email sent.
 */

// Initialize AWS SDK components
const s3 = new S3Client({ region: config.aws.region });
const ses = new SESClient({ region: config.aws.region });





let connection = null;
let channel = null;
let consumerTag = null;

/**
 * Retrieves an email template from S3.
 *
 * @async
 * @function getEmailTemplate
 * @param {string} templateId - The ID of the template to retrieve.
 * @returns {Promise<string>} The email template as a string.
 * @throws {Error} If there is an error retrieving the template from S3.
 */
async function getEmailTemplate(templateId) {
    const params = {
        Bucket: config.aws.s3BucketName,
        Key: `${templateId}.html`, // Assuming templates are stored as .html files
    };

    const command = new GetObjectCommand(params);
    try {
        const data = await s3.send(command);
        return data.Body.toString('utf-8');
    } catch (error) {
        logger.error('Error retrieving template from S3', { templateId, error: error.message, stack: error.stack });
        throw error;
    } 
}

/**
 * Sends an email using AWS SES.
 *
 * @async
 * @function sendEmail
 * @param {string} to - The recipient's email address.
 * @param {string} subject - The email subject.
 * @param {string} body - The email body (HTML).
 * @param {string} messageId - The message ID for logging purposes.
 * @returns {Promise<object>} The response from SES.
 * @throws {Error} If there is an error sending the email.
 */
async function sendEmail(to, subject, body, messageId) {
    const params = {
        Destination: {
            ToAddresses: [to],
        },
        Message: {
            Body: {
                Html: {
                    Charset: 'UTF-8',
                    Data: body,
                },
            },
            Subject: {
                Charset: 'UTF-8',
                Data: subject,
            },
        },
        Source: config.aws.sesSenderEmail,
    };

    try {
        logger.info('Sending email with SES', { to, subject, messageId });
        const command = new SendEmailCommand(params);
        const data = await ses.send(command);
        logger.info('Email sent successfully', { messageId, sesMessageId: data.MessageId });
        return data;
    } catch (error) {
        logger.error('Error sending email with SES', { to, subject, messageId, error: error.message, stack: error.stack });
        throw error;
    }
}

/**
 * Processes a message from the email queue.
 *
 * @async
 * @function processMessage
 * @param {object} msg - The message object received from RabbitMQ.
 * @param {object} channel - The RabbitMQ channel.
 * @returns {Promise<void>}
 */
async function processMessage(msg, channel) {
    if (msg === null) {
        logger.warn("Consumer received null message, possibly cancelled.");
        return;
    }
    
    let notificationData;
    let notificationRecord;
    const messageContent = msg.content.toString();

    try {
        notificationData = JSON.parse(messageContent);
        const { dbId, messageId, templateId, message, channel: to } = notificationData;

        if (!dbId || !messageId || !templateId || !message || !to) {
            logger.error("Invalid message format received from queue", { content: messageContent });
            channel.nack(msg, false, false);
            return;
        }

        logger.info('Received message from RabbitMQ', { messageId, dbId, templateId, to });

        const transaction = await db.sequelize.transaction();
        try {
            notificationRecord = await db.Notification.findOne({  // access Notification model dynamically
                where: { messageId: messageId },
                lock: transaction.LOCK.UPDATE, // Lock the row to prevent concurrent processing
                transaction: transaction,
            });

            if (!notificationRecord) {
                logger.error(`Notification record not found in DB for messageId: ${messageId}. Discarding message.`, { messageId, dbId });
                await transaction.commit();
                channel.nack(msg, false, false);
                return;
            }

            if (notificationRecord.status === "sent") {
                logger.warn(`Notification already marked as sent. Acknowledging message.`, { messageId, dbId: notificationRecord.id });
                await transaction.commit();
                channel.ack(msg);
                return;
            }

            if (notificationRecord.status === "processing") {
                logger.warn(`Notification is already being processed. Acknowledging message.`, { messageId, dbId: notificationRecord.id });
                await transaction.commit();
                channel.ack(msg);
                return;
            }

            if (notificationRecord.attempts >= config.maxProcessingAttempts && notificationRecord.status === 'failed') {
                logger.error(`Notification has reached max processing attempts (${config.maxProcessingAttempts}). Marking as permanent failure.`, { messageId, dbId: notificationRecord.id });
                notificationRecord.status = "failed";
                notificationRecord.connectorResponse = (notificationRecord.connectorResponse || '') + ` | Max attempts reached.`;
                await notificationRecord.save({ transaction: transaction });
                await transaction.commit();
                channel.ack(msg);
                return;
            }

            logger.info(`Updating notification status to 'processing'`, { messageId, dbId: notificationRecord.id, attempt: notificationRecord.attempts + 1 });
            notificationRecord.status = 'processing';
            notificationRecord.attempts += 1;
            await notificationRecord.save({ transaction: transaction });
            await transaction.commit();
        } catch (dbError) {
            logger.error('Database error during pre-processing', {
                messageId,
                dbId: notificationData?.dbId,
                error: dbError.message,
                stack: dbError.stack,
            });
            await transaction.rollback();
            channel.nack(msg, false, false);
            return;
        }

        try {
            const template = await getEmailTemplate(templateId);
            const compiledTemplate = Handlebars.compile(template);
            const emailBody = compiledTemplate(message);
            const subject = 'Notification Email'; // You might want to get the subject from the template or the message object
            // --- Actual Processing (Send Email) ---\
            await sendEmail(to, subject, emailBody, messageId);
            await db.Notification.update(   // access Notification model dynamically
                { status: "sent" },
                { where: { id: notificationRecord.id } }
            );
            logger.info(`Notification status updated to 'sent'`, { messageId, dbId: notificationRecord.id });
            channel.ack(msg);
        } catch (processingError) {
            logger.error('Error processing email', { messageId, dbId: notificationRecord.id, error: processingError.message, stack: processingError.stack });
            // Update DB with 'failed' state and error info
            logger.error(`Slack send failed. Updating status to 'failed'`, { messageId, dbId: notificationRecord.id, error: processingError.message });
            await db.Notification.update(  // access Notification model dynamically
                { status: 'failed', connectorResponse: processingError.message }, // Store error message
                { where: { id: notificationRecord.id } }
            );

            logger.warn(`Notification status updated to 'failed'`, { messageId, dbId: notificationRecord.id });

            await db.Notification.update({ status: 'failed', connectorResponse: processingError.message }, { where: { id: notificationRecord.id } });
            channel.ack(msg);
        }
    } catch (error) {
        logger.error('Critical error processing message', { messageContent, error: error.message, stack: error.stack });
        channel.nack(msg, false, false);
    }
}

/**
 * Establishes a connection to RabbitMQ and starts consuming messages.
 *
 * @async
 * @function connectAndConsume
 * @returns {Promise<void>}
 */
async function connectAndConsume() {
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelay = 5000; // 5 seconds

    while (retryCount < maxRetries) {
        try {
            logger.info('Connecting to RabbitMQ...');
            connection = await amqp.connect(config.rabbitMQ.url);
            channel = await connection.createChannel();
            logger.info('RabbitMQ connected.');

            connection.on('error', handleRabbitError);
            connection.on('close', handleRabbitClose);

            await channel.assertExchange(config.rabbitMQ.exchangeName, config.rabbitMQ.exchangeType, { durable: true });

            logger.info(`Exchange '${config.rabbitMQ.exchangeName}' asserted.`);

            const queueArgs = { durable: true };
            const q = await channel.assertQueue(config.rabbitMQ.queueName, queueArgs);
            logger.info(`Queue '${q.queue}' asserted.`);

            await channel.bindQueue(q.queue, config.rabbitMQ.exchangeName, config.rabbitMQ.bindingKey);
            logger.info(`Queue '${q.queue}' bound to exchange '${config.rabbitMQ.exchangeName}' with key '${config.rabbitMQ.bindingKey}'.`);

            logger.info('Testing database connection...');
            // Dynamically import the models and pass the environment
            db = require('../models')(process.env.NODE_ENV);
            await db.sequelize.authenticate();

            logger.info('Database connection successful.');

            channel.prefetch(1);
            logger.info(`[*] Waiting for messages in queue '${q.queue}'. To exit press CTRL+C`);

            const consumeResult = await channel.consume(q.queue, (msg) => processMessage(msg, channel), { noAck: false });
            consumerTag = consumeResult.consumerTag;
            logger.info(`Consumer started with tag: ${consumerTag}`);
            break; // If successful, break out of the retry loop
        } catch (error) {
            logger.error('Failed to connect or consume from RabbitMQ / DB check failed:', { error: error.message, stack: error.stack });
            await closeConnections(true);
            retryCount++;
            logger.info(`Retrying connection in ${retryDelay / 1000} seconds... (Attempt ${retryCount}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay)); // Wait before retrying
        }
    }

    if (retryCount === maxRetries) {
        logger.error('Max connection retries reached. Exiting...');
        process.exit(1); // Exit if max retries reached
    }
}

let isShuttingDown = false;

/**
 * Handles RabbitMQ connection errors.
 *
 * @function handleRabbitError
 * @param {Error} err - The error object.
 */
function handleRabbitError(err) {
    logger.error('RabbitMQ connection error:', { errorMessage: err.message, stack: err.stack });
}

/**
 * Handles the RabbitMQ connection close event.
 *
 * @function handleRabbitClose
 */
function handleRabbitClose() {
    if (isShuttingDown) return;
    logger.warn('RabbitMQ connection closed.');

    consumerTag = null;
    channel = null;
    connection = null;
    logger.info('Attempting RabbitMQ reconnection in 10 seconds...');
    setTimeout(connectAndConsume, 10000);
}

/**
 * Closes all open connections and performs cleanup.
 *
 * @async
 * @function closeConnections
 * @param {boolean} [attemptReconnect=false] - Whether this is part of a reconnect attempt or final shutdown.
 * @returns {Promise<void>}
 */
async function closeConnections(attemptReconnect = false) {
    if (isShuttingDown && !attemptReconnect) return;
    isShuttingDown = !attemptReconnect;

    logger.info('Closing connections...');

    if (channel && consumerTag) {
        try {
            logger.info(`Cancelling consumer: ${consumerTag}`);
            await channel.cancel(consumerTag);

            logger.info('Consumer cancelled.');
        } catch (err) {
            logger.error('Error cancelling consumer:', { errorMessage: err.message });
        }
        consumerTag = null;
    } else {
        logger.info('No active consumer to cancel.');
    }

    if (channel) {
        try {
            await channel.close();
            logger.info('RabbitMQ channel closed.');

        } catch (err) {
            logger.error('Error closing RabbitMQ channel:', { errorMessage: err.message });
        }
        channel = null;
    }

    if (connection) {
        try {
            connection.off('error', handleRabbitError);
            connection.off('close', handleRabbitClose);

            await connection.close();
            logger.info('RabbitMQ connection closed.');
        } catch (err) {
            logger.error('Error closing RabbitMQ connection:', { errorMessage: err.message });
        }
        connection = null;
    }

    if (db && db.sequelize) {
        try {
            await db.sequelize.close();
            logger.info('Database connection closed.');

        } catch (err) {
            logger.error('Error closing database connection:', { errorMessage: err.message });
        }
    }

    logger.info('Connections closed.');
    if (isShuttingDown) {
        process.exit(0);
    }
}

// Graceful shutdown handlers
process.on('SIGTERM', () => {
    logger.info('Received SIGTERM signal.');
    closeConnections();
});
process.on('SIGINT', () => {
    logger.info('Received SIGINT signal (Ctrl+C).');
    closeConnections();
});

// Handle unhandled promise rejections / uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason: reason?.message || reason });
});
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
});

// Start the connector
logger.info('Starting Email Connector...');
connectAndConsume();