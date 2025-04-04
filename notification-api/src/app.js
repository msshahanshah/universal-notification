// ./notification-api/src/app.js
const express = require('express');
const { v4: uuidv4 } = require('uuid'); // For generating unique IDs
const { publishMessage } = require('./rabbitMQClient');
const config = require('./config');
const logger = require('./logger');
const db = require('../models'); // Import Sequelize models (index.js in models dir)
const Notification = db.Notification; // Get the Notification model

const app = express();

// Middleware
app.use(express.json());

// Routes
app.get('/health', (req, res) => {
    // Optionally add DB and RabbitMQ connection checks here
    res.status(200).send('OK');
});

app.post('/notify', async (req, res) => {
    const { service, channel: targetChannel, message } = req.body;
    const messageId = uuidv4(); // Generate unique ID for this notification

    // Validation
    if (!service || !targetChannel || !message) {
        logger.warn('Validation failed: Missing fields', { body: req.body, messageId });
        return res.status(400).json({
            error: 'Missing required fields: service, channel, message',
        });
    }
    const allowedServices = ['slack', 'email', 'telegram'];
    const lowerCaseService = service.toLowerCase();
    if (!allowedServices.includes(lowerCaseService)) {
         logger.warn('Validation failed: Invalid service', { service, messageId });
         return res.status(400).json({
            error: `Invalid service specified. Allowed services are: ${allowedServices.join(', ')}`,
        });
    }

    // 1. Save to Database First
    let notificationRecord;
    try {
        logger.info(`Creating notification record in DB`, { messageId, service: lowerCaseService, targetChannel });
        notificationRecord = await Notification.create({
            messageId: messageId,
            service: lowerCaseService,
            target: targetChannel,
            content: message,
            status: 'pending', // Initial status
            attempts: 0,
        });
        logger.info(`Notification record created successfully`, { id: notificationRecord.id, messageId });

    } catch (dbError) {
        logger.error('Database error: Failed to create notification record', {
            messageId,
            error: dbError.message,
            stack: dbError.stack,
            // parent: dbError.parent, // Original DB error if available
            // sql: dbError.sql // SQL query if available
        });
        // Check for unique constraint violation (maybe duplicate messageId, though unlikely with UUIDv4)
        if (dbError.name === 'SequelizeUniqueConstraintError') {
             return res.status(409).json({ error: 'Conflict: A notification with this identifier potentially exists.', messageId });
        }
        return res.status(500).json({ error: 'Failed to save notification request.' });
    }

    // 2. Publish to RabbitMQ
    const notificationData = {
        // Include DB record ID and messageId in the message payload
        dbId: notificationRecord.id, // The auto-incremented primary key
        messageId: messageId, // The unique UUID
        service: lowerCaseService,
        channel: targetChannel, // Keep original casing if needed by connector
        message,
        timestamp: new Date().toISOString(),
    };

    try {
        logger.info(`Publishing notification request to RabbitMQ`, { messageId, service: lowerCaseService, exchange: config.rabbitMQ.exchangeName, routingKey: lowerCaseService });
        await publishMessage(lowerCaseService, notificationData); // Use service name as routing key
        logger.info(`Notification request published successfully`, { messageId });

        // Optionally: Update DB status to 'queued' here if desired, but 'pending' is often sufficient
        // await notificationRecord.update({ status: 'queued' });

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

        // Critical Decision: If publish fails after DB record created, what to do?
        // Option 1: Leave DB record as 'pending'. A background job could retry publishing later. (More complex)
        // Option 2: Update DB record to 'failed' state immediately. (Simpler)
        // Option 3: Delete the DB record. (Data loss)
        // Let's go with Option 2 for now.
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
             // At this point, state is inconsistent (pending in DB, but failed to publish)
        }

        res.status(500).json({ error: 'Failed to queue notification request after saving.' });
    }
});

// Update Error Handling Middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', { error: err.message, stack: err.stack, url: req.originalUrl, method: req.method });
    res.status(500).send('Something broke!');
});

module.exports = app;