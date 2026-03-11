const express = require("express");
const { validateLogsQuery } = require("./../logs-api/validation");
const { slackMessageLogs } = require("./controller");
const auth = require("../middleware/auth.middleware");
const accessControl = require("../middleware/access-control.middleware");
const slackRouter = express.Router();

slackRouter.get(
  "/slack-logs",
  validateLogsQuery,
  auth,
  accessControl,
  slackMessageLogs,
);

module.exports = slackRouter;
