const express = require("express");
const { getBalance, viewBalance } = require("./controller");
const statRouter = express.Router();

statRouter.get("/refresh-balance", getBalance);
statRouter.get("/balance", viewBalance);

module.exports = statRouter;