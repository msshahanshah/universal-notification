const express = require("express");
const { validateLogsQuery } = require("./validation");
const { messageLogs, deliveryStatus } = require("./controller");
const logRouter = express.Router();

logRouter.get("/delivery-status/:id", deliveryStatus);
logRouter.get("/logs", validateLogsQuery, messageLogs);

module.exports = logRouter;
