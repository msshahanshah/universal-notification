const mongoose = require("mongoose");

const webhookConfigSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
    },
    webhookUrl: { type: String, required: true },
    encryptedKey: { type: String, required: true },
    serviceTrigger: {
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
    deletedAt: Date,
  },
  { timestamps: true },
);

webhookConfigSchema.index(
  { clientId: 1, webhookUrl: 1, deletedAt: 1 },
  { unique: true },
);

module.exports = mongoose.model("WebhookConfig", webhookConfigSchema);
