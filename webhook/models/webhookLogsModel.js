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

serviceTrigger: { // {sms: ["success"}
  type: Object,
  required: true,
},

status: {
  type: String,
  enum: ["success", "failed"],
  required: true,
},

retryAttempts: {
  type: Number,
  default: 0,
},
webhookPayload: { //messageId, message, clientId etc.
type: Object,
  required: true
},

webhookResponse:{
  type: Object,
  required: true
}
},
{ timestamps: true }
);

webhookLogsSchema.index({ clientId: 1 });
module.exports = mongoose.model("WebhookLog", webhookLogsSchema);