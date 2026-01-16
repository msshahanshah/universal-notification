// ./notification-api/src/app.js
/**
 * Main application file for the Notification API.
 * Sets up the Express server, defines routes, and handles request logic.
 */
const express = require("express");
const authController = require("./controller");
const loginValidateRequest = require("./validation");

const authRouter = express.Router();

authRouter.post("/login", loginValidateRequest, authController.login);
authRouter.post("/refresh", authController.refresh);

module.exports = authRouter;
