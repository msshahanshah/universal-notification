const express = require("express");
const auth = require("../middleware/auth.middleware");
const accessControl = require("../middleware/access-control.middleware");
const WebhookController = require("./controller");
const webhookValidation = require("./validation");
const router = express.Router();

router.post(
  "/webhooks",
  auth,
  accessControl,
  webhookValidation,
  WebhookController.addWebhook,
);
router.patch(
  "/webhooks/:webhookId",
  auth,
  accessControl,
  webhookValidation,
  WebhookController.updateWebhook,
);
router.delete(
  "/webhooks/:webhookId",
  auth,
  accessControl,
  WebhookController.deleteWebhook,
);
router.get("/webhooks", auth, accessControl, WebhookController.getWebhooks);

module.exports = router;
