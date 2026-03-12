require("dotenv").config();

const axios = require("axios");
const WebhookConfig = require("../models/webhook");
const { extractServiceFromServicesTrigger } = require("../helpers/webhook.helper");
const { decrypt } = require("../utils/cryptoUtil");

// TODO: use this consume function with rabbitmq
const consumeNotification = async (payload) => {
  // expects payload from notification service
  // trigger webhook api with payload
  const configs = await WebhookConfig.findOne({
    clientId: payload.clientId,
  });

  if (!configs) {
    throw new Error(
      `Webhook config not found for clientId: ${payload.clientId}`,
    );
  }

  // const serviceMatched = extractServiceFromServicesTrigger(configs, payload);

  // if (!serviceMatched) {
  //   throw new Error(
  //     `Service ${payload.service}_${payload.status} not enabled for clientId: ${payload.clientId}`,
  //   );
  // }

  const salt = configs.clientId + process.env.MASTER_ENCRYPTION_KEY;
  const decryptedApiKey = decrypt(configs.encryptedKey, salt);

  try {
    const response = await axios.post(configs.webhookUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${decryptedApiKey}`,
      },
      timeout: 5000, // always set timeout
    });
    console.log("response.data", response.data);

    return response.data;
  } catch (err) {
    console.error("Webhook call failed:", err.message);

    throw new Error(
      `Error: ${err}; Webhook delivery failed for clientId: ${payload.clientId}`,
    );
  }
};

module.exports = { consumeNotification };
