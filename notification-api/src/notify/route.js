// ./notification-api/src/app.js
/**
 * Main application file for the Notification API.
 * Sets up the Express server, defines routes, and handles request logic.
 */
const express = require("express");
const validateRequest = require("./validation");
const notify = require("./controller");
const notificationRouter = express.Router();

notificationRouter.post("/notify", validateRequest, notify);

module.exports = notificationRouter;
