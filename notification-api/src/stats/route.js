const express = require("express");
const { getBalance, viewBalance } = require("./controller");
const auth = require("../middleware/auth.middleware");
const accessControl = require("../middleware/access-control.middleware");
const statRouter = express.Router();

statRouter.get("/refresh-balance", auth, accessControl, getBalance);
statRouter.get("/balance", auth, accessControl, viewBalance);

module.exports = statRouter;