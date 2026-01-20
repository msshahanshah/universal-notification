const express = require("express");
const { validateLogsQuery } = require("./validation");
const { messageLogs, deliveryStatus } = require("./controller");
const auth = require("./auth.middleware");
const accessControl = require("./access-control.middleware");
const logRouter = express.Router();

logRouter.get("/delivery-status/:id", auth, accessControl, deliveryStatus);
logRouter.get("/logs", validateLogsQuery, auth, accessControl, messageLogs);

module.exports = logRouter;
