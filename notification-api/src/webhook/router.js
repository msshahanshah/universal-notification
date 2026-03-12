const express = require("express");
const auth = require("../middleware/auth.middleware");
const WebhookController = require("./controller");
const webhookValidation = require("./validation");
const router = express.Router();

router.post("/webhooks", auth, webhookValidation, WebhookController.addWebhook);
router.patch(
  "/webhooks/:webhookId",
  auth,
  webhookValidation,
  WebhookController.updateWebhook,
);
router.delete("/webhooks/:webhookId", auth, WebhookController.deleteWebhook);

module.exports = router;
