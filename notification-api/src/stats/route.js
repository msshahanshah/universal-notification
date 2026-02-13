const express = require("express");
const { getBalance, viewBalance } = require("./controller");
const auth = require("../middleware/auth.middleware");
const accessControl = require("../middleware/access-control.middleware");
const validateRequest = require("./validation");
const statRouter = express.Router();

statRouter.get(
  "/refresh-balance",
  validateRequest,
  auth,
  accessControl,
  getBalance,
);
statRouter.get("/balance", validateRequest, auth, accessControl, viewBalance);

module.exports = statRouter;
