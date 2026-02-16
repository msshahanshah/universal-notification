const express = require("express");
const authController = require("./controller");
const {
  loginValidateRequest,
  refreshValidateRequest,
} = require("./validation");
const auth = require("../middleware/auth.middleware");

const authRouter = express.Router();

authRouter.post("/login", loginValidateRequest, authController.login);
authRouter.post("/refresh", refreshValidateRequest, authController.refresh);
authRouter.post("/logout", auth, authController.logout);

module.exports = authRouter;
