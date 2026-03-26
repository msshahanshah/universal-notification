const express = require("express");
const { webhookController } = require("./controller");
const webhookRouter = express.Router();

webhookRouter.post(`/webhook/sms`, webhookController);

module.exports = webhookRouter;
