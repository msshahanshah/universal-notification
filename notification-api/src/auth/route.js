const express = require("express");
const authController = require("./controller");
const {
  loginValidateRequest,
  refreshValidateRequest,
} = require("./validation");
const auth = require("../middleware/auth.middleware");

const accessControl = require("../middleware/access-control.middleware");
const authRouter = express.Router();

authRouter.post("/login", loginValidateRequest, authController.login);
authRouter.post("/refresh", refreshValidateRequest, authController.refresh);
authRouter.post("/logout", auth, accessControl, authController.logout);

module.exports = authRouter;
