const express = require("express");
const validateRequest = require("./validation");
const { notify, notifyWithEmailAttachment } = require("./controller");

const auth = require("../middleware/auth.middleware");
const accessControl = require("../middleware/access-control.middleware");
const notificationRouter = express.Router();

notificationRouter.post(
  "/notify",
  auth,
  accessControl,
  validateRequest,
  notify,
);
notificationRouter.post("/notify-with-attachment", notifyWithEmailAttachment);

module.exports = notificationRouter;
