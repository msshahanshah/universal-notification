// ./notification-api/src/app.js
/**
 * Main application file for the Notification API.
 * Sets up the Express server, defines routes, and handles request logic.
 */
const express = require("express");
const validateRequest = require("./validation");
const { notify, notifyWithEmailAttachment } = require("./controller");
const auth = require("../logs-api/auth.middleware");
const notificationRouter = express.Router();

notificationRouter.post("/notify", auth, validateRequest, notify);

notificationRouter.post("/notify-with-attachment", auth, notifyWithEmailAttachment);

module.exports = notificationRouter;
