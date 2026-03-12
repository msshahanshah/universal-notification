const mongoose = require("mongoose");

const webhookConfigSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true, unique: true },
    webhookUrl: { type: String, required: true },
    encryptedKey: { type: String, required: true },
    serviceTrigger: {
      type: Object,
      required: true,
    },
    settings: {
      type: Object,
      required: true,
    },
    retryEnabled: {
      type: Boolean,
      default: false,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

webhookConfigSchema.index({ clientId: 1 }, { unique: true });
module.exports = mongoose.model("WebhookConfig", webhookConfigSchema);
