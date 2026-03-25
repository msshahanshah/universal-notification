const mongoose = require("mongoose");
const webhookCronSchedulerSchema = new mongoose.Schema(
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
      // {sms: ["success"]}
      type: Object,
      required: true,
    },

    status: {
      type: String,
      enum: ["success", "failed", "pending"],
      required: true,
    },

    retryAttempts: {
      type: Number,
      default: 0,
    },

    webhookResponse: {
      type: Object,
      required: true,
    },

    webhookPayload: {
      //messageId, service, status, message, clientId etc.
      type: Object,
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model(
  "WebhookCronScheduler",
  webhookCronSchedulerSchema,
);
