const express = require("express");
const webhookRouter = express.Router();

const {whatsAppController} = require('./controller');
webhookRouter.post(`/webhook/whatsapp`, whatsAppController);

module.exports = webhookRouter;
