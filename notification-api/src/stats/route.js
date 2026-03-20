const express = require("express");
const { getBalance, viewBalance } = require("./controller");
const auth = require("../middleware/auth.middleware");
const accessControl = require("../middleware/access-control.middleware");
const validateQueryRequest = require("./validation");
const statRouter = express.Router();

statRouter.post("/refresh-balance", auth, accessControl, validateQueryRequest, getBalance);
statRouter.get("/balance", auth, accessControl, validateQueryRequest, viewBalance);

module.exports = statRouter;