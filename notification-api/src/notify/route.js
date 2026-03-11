// ./notification-api/src/app.js
/**
 * Main application file for the Notification API.
 * Sets up the Express server, defines routes, and handles request logic.
 */
const express = require("express");
const validateRequest = require("./validation");
const { notify, notifyWithEmailAttachment } = require("./controller");
const { notify: v2notify } = require("./v2/controller");
const { validateRequest: v2validateRequest } = require("./v2/validation");

const auth = require("../middleware/auth.middleware");
const accessControl = require("../middleware/access-control.middleware");
const notificationRouter = express.Router();

notificationRouter.post(
  "/notify",
  auth,
  accessControl,
  validateRequest,
  notify,
);
notificationRouter.post(
  "/v2/notify",
  auth,
  accessControl,
  v2validateRequest,
  v2notify,
);
notificationRouter.post("/notify-with-attachment", notifyWithEmailAttachment);

module.exports = notificationRouter;
