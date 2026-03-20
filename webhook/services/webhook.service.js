require("dotenv").config();

const WebhookConfig = require("../models/webhook");
const WebhookCronScheduler = require("../models/webhookCronSchedulerModel");
const {} = require("../helpers/webhook.helper");
const logger = require("../utils/logger");

const consumeNotification = async (payload) => {
  try {
    const { service, status, clientId, messageId } = payload;
    const query = {
      clientId: clientId,
      [`serviceTrigger.${service}`]: status,
    };

    const webhooks = await WebhookConfig.find(query).lean();

    const docs = webhooks.map((doc) => {
      return {
        id: doc._id,
        clientId: clientId,
        webhookUrl: doc.webhookUrl,
        serviceTrigger: doc.serviceTrigger,
        status: "pending",
        retryAttempts: 0,
        webhookPayload: {
          messageId: messageId,
          service,
          status,
          clientId,
        },
      };
    });

    logger.info(`Docs fetched from webhook configs`);
    await WebhookCronScheduler.insertMany(docs);
    logger.info(`Docs inserted in mongo cron scheduler collection`);
    // TODO make first webhook call from here. It will not await for webhook.
  } catch (err) {
    logger.error(`Error in consuming webhook request ${err}`);
    throw err;
  }
};

module.exports = { consumeNotification };
