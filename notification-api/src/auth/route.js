const express = require("express");
const authController = require("./controller");
const {
  loginValidateRequest,
  refreshValidateRequest,
} = require("./validation");

const authRouter = express.Router();

authRouter.post("/login", loginValidateRequest, authController.login);
authRouter.post("/refresh", refreshValidateRequest, authController.refresh);

module.exports = authRouter;
