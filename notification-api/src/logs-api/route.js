const express = require("express");
const { validateLogsQuery } = require("./validation");
const { messageLogs, deliveryStatus } = require("./controller");
const auth = require("./auth.middleware");
const logRouter = express.Router();

logRouter.get("/delivery-status/:id", auth, deliveryStatus);
logRouter.get("/logs", validateLogsQuery, auth, messageLogs);

module.exports = logRouter;
