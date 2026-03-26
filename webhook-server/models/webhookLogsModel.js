const mongoose = require("mongoose");
const webhookLogsSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      index: true,
    },

    webhookUrl: {
      type: String,
      required: true,
    },

    serviceTrigger: {
      type: Object,
      required: true,
    },

    status: {
      type: String,
      enum: ["success", "failed", "pending"],
      default: "pending",
      required: true,
    },

    retryAttempts: {
      type: Number,
      default: 0,
    },
    webhookPayload: {
      type: Object,
      required: true,
    },

    webhookResponse: {
      type: Object,
      required: true,
    },
  },
  { timestamps: true },
);

webhookLogsSchema.index({ clientId: 1 });
module.exports = mongoose.model("WebhookLog", webhookLogsSchema);
