const express = require('express');
const deliveryStatus = require('./controller');
const logRouter = express.Router();

logRouter.get("/delivery-status/:id", deliveryStatus);

module.exports = logRouter;