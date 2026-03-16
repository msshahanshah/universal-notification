const express = require("express");
const { validateLogsQuery } = require("./validation");
const { messageLogs, deliveryStatus ,slackMessageLogs} = require("./controller");
const auth = require("../middleware/auth.middleware");
const accessControl = require("../middleware/access-control.middleware");
const logRouter = express.Router();

logRouter.get("/delivery-status/:id", auth, accessControl, deliveryStatus);
logRouter.get("/logs", auth, accessControl, validateLogsQuery, messageLogs);
logRouter.get(
  "/slack-logs",
  validateLogsQuery,
  auth,
  accessControl,
  slackMessageLogs,
);
module.exports = logRouter;
