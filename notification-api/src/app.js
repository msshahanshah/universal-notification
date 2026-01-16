// ./notification-api/src/app.js
/**
 * Main application file for the Notification API.
 * Sets up the Express server, defines routes, and handles request logic.
 */
const express = require('express');
const logger = require('./logger');

const notificationRouter = require('./notify/route');
const deliveryStatusRouter = require('./logs-api/route');
const logRouter = require('./logs-api/route');


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
    logger.debug('Health check endpoint hit', { clientId: process.env.CLIENT_ID });
    res.status(200).send('OK');
});
app.use(notificationRouter);
app.use(logRouter);
/**
 * Route for creating and publishing a notification request.`
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