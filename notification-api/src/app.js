// ./notification-api/src/app.js
/**
 * Main application file for the Notification API.
 * Sets up the Express server, defines routes, and handles request logic.
 */
const express = require("express");
const logger = require("./logger");

const notificationRouter = require("./notify/route");
const logRouter = require("./logs-api/route");

const authRouter = require("./auth/route");
const statRouter = require("./stats/route");
const templateRouter = require("./template/route");

const app = express();

// Global Middlewares
// default payload size limit is 100 KB
app.use(express.json());

app.use(notificationRouter);
app.use(logRouter);
app.use(authRouter);
app.use(statRouter);
app.use(templateRouter);

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
  switch (err.type) {
    case "entity.parse.failed":
      return res.status(400).json({
        success: false,
        message: "Invalid Request Body",
      });
    case "entity.too.large":
      return res.status(413).json({
        success: false,
        message: "Too large request",
      });
    default:
      logger.error("Unhandled error:", {
        error: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
      });

      return res.status(500).json({
        message: "Something broke!",
      });
  }
});

module.exports = app;
