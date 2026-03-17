const mongoose = require("mongoose");

const rabbitConfigSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      unique: true, // 🔥clientId Ensures only one config per client
    },

    url: { type: String, required: true },
    exchange: { type: String, required: true },
    queue: { type: String, required: true },
    routingKey: { type: String, required: true },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RabbitConfig", rabbitConfigSchema);
