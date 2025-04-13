// ./notification-api/src/app.js
/**
 * Main application file for the Notification API.
 * Sets up the Express server, defines routes, and handles request logic.
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid'); // For generating unique IDs
const { publishMessage } = require('./rabbitMQClient');
const config = require('./config');
const logger = require('./logger');
const db = require('../models');
const Notification = db.Notification;

const app = express();

// Middleware
app.use(express.json());

/**
 * Health check route.
 * @route GET /health
 * @group Health - Operations related to the health of the API
 * @returns {object} 200 - An indicator that the API is healthy.
 * @returns {Error}  default - Unexpected error
 */
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

/**
 * Route for creating and publishing a notification request.
 * @route POST /notify
 * @group Notification - Operations related to sending notifications
 * @param {string} service.body.required - The service to use for sending the notification (e.g., 'slack', 'email', 'telegram').
 * @param {string} channel.body.required - The target for the notification. For email this is the email address, for Slack is the channel id.
 * @param {object} [message.body] - The message content for the notification. Required if service is 'email'. This is an object for templating.
 * @param {string} [templateId.body] - The template ID for the notification. Required if service is 'email'
 * @returns {object} 202 - Notification request accepted and queued. - Notification request accepted and queued.
 * @returns {object} 400 - Invalid request data. - Invalid request data.
 * @returns {object} 400 - Invalid request data.
 * @returns {object} 409 - Conflict: A notification with this identifier potentially exists.
 * @returns {object} 500 - Internal server error, failed to queue notification.
 */

/**
 * @typedef {Object} NotificationRequest
 * @property {string} templateId - The template id for the notification. Required if service is 'email'.
 * @property {object} message - The message content for the notification. Required if service is 'email'.
 * @property {string} service - The service to use for sending the notification.
 * @property {string} target - The target for the notification.
 */
app.post('/notify', async (req, res) => {
    const { service, channel: targetChannel, message } = req.body;
    const messageId = uuidv4();

    // Validation
    if (!service || !targetChannel || !message) {
        logger.warn('Validation failed: Missing fields', { body: req.body, messageId });
         return res.status(400).json({
             error: 'Missing required fields: service, channel, message',
         });
    } 
    const allowedServices = ['slack', 'email', 'telegram'];
    const lowerCaseService = service.toLowerCase();

    // Validate email specific fields
    if (lowerCaseService === 'email') {
        if (!req.body.templateId) {
            logger.warn('Validation failed: Missing templateId for email', { body: req.body, messageId });
            return res.status(400).json({ error: 'Missing templateId for email service' });
        }
        if (!message) {
            logger.warn('Validation failed: Missing message for email service', { body: req.body, messageId });
            return res.status(400).json({ error: 'Missing message for email service' });
        }

        if (typeof message !== 'object' || message === null) {
            logger.warn('Validation failed: message is not an object for email service', { body: req.body, messageId });
            return res.status(400).json({ error: 'Invalid message format: must be an object for email service' });
        }
    }
    if (!allowedServices.includes(lowerCaseService)) {
         logger.warn('Validation failed: Invalid service', { service, messageId });
         return res.status(400).json({
            error: `Invalid service specified. Allowed services are: ${allowedServices.join(', ')}`,
        });
    }

    let notificationRecord;
    try {
        logger.info(`Creating notification record in DB`, { messageId, service: lowerCaseService, targetChannel, templateId: req.body.templateId });
        notificationRecord = await Notification.create({
            messageId: messageId,
            target: targetChannel,
            content: message,
            status: 'pending', // Initial status
            attempts: 0,
            templateId: req.body.templateId,
            
        });

        logger.info(`Notification record created successfully`, { id: notificationRecord.id, messageId });

    } catch (dbError) {
        logger.error('Database error: Failed to create notification record', {
            messageId,
            error: dbError.message,
            stack: dbError.stack,
        });

        if (dbError.name === 'SequelizeUniqueConstraintError') {
             return res.status(409).json({ error: 'Conflict: A notification with this identifier potentially exists.', messageId });
        }
        return res.status(500).json({ error: 'Failed to save notification request to database.' });
    }

    const notificationData = {
        // Include DB record ID and messageId in the message payload
        dbId: notificationRecord.id, // The auto-incremented primary key
        messageId: messageId, // The unique UUID
        service: lowerCaseService,
        channel: targetChannel, // Keep original casing if needed by connector
        message,
        templateId: req.body.templateId,

        timestamp: new Date().toISOString(),
    };

      try {
        logger.info(`Publishing notification request to RabbitMQ`, { messageId, service: lowerCaseService, routingKey: lowerCaseService });
        await publishMessage(lowerCaseService, notificationData);
        logger.info(`Notification request published successfully`, { messageId });

        res.status(202).json({
            status: 'accepted',
            message: 'Notification request accepted and queued.',
            messageId: messageId, // Return the ID to the client
        });

    } catch (publishError) {
        logger.error('RabbitMQ error: Failed to publish notification request', {
             messageId,
             dbId: notificationRecord.id,
             error: publishError.message,
             stack: publishError.stack
        });
        try {
            await notificationRecord.update({
                 status: 'failed',
                 connectorResponse: `Failed to publish to RabbitMQ: ${publishError.message}`
            });
             logger.warn(`Updated notification status to 'failed' due to publish error`, { messageId, dbId: notificationRecord.id });
        } catch (updateError) {
             logger.error('DB error: Failed to update notification status to "failed" after publish error', {
                messageId,
                dbId: notificationRecord.id,
                updateError: updateError.message,
                stack: updateError.stack
             });
        }

        res.status(500).json({ error: 'Failed to queue notification request after saving.' });
    }
});


// Update Error Handling Middleware
/**
 * Error handling middleware.
 * @param {Error} err - The error object.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @param {function} next - The next middleware function.
 */
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', { error: err.message, stack: err.stack, url: req.originalUrl, method: req.method });
    res.status(500).send('Something broke!');
});

module.exports = app;