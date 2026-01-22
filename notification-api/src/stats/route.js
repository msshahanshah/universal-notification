const express = require("express");
const {  getBalance } = require("./controller");
const statRouter = express.Router();

statRouter.get("/balance", getBalance);

module.exports = statRouter;