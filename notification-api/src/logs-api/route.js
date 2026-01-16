const express = require('express');
const { validateLogsQuery, validateLogsSchema } = require('./validation');
const { messageLogs, deliveryStatus } = require('./controller');
const logRouter = express.Router();

logRouter.get("/delivery-status/:id", deliveryStatus);
logRouter.get("/logs",
    validateLogsQuery(validateLogsSchema),
    messageLogs);

module.exports = logRouter;