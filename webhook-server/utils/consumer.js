require("dotenv").config();

const WebhookConfig = require("../models/webhook");
const WebhookCronScheduler = require("../models/webhookCronSchedulerModel");

const { processNotifications } = require("../helpers/job.helper");

const logger = require("./logger");

const consumer = async (payload) => {
  try {
    const { service, status, clientId, details } = payload;
    const { messageId } = details;
    logger.info(`Webhook consume start: messageId=${messageId}`);

    const query = {
      clientId,
      isActive: true,
      deletedAt: null,
      [`serviceTrigger.${service}`]: { $exists: true, $eq: status },
    };

    const configs = await WebhookConfig.find(query).select("webhookUrl apiKey");

    logger.info(`Found ${configs.length} webhook configs`);

    const schedulerDocs = configs.map((record) => ({
      clientId,
      webhookUrl: record.webhookUrl,
      status: "pending",
      serviceTrigger: { [service]: status },
      retryAttempts: 0,
      webhookPayload: payload,
      webhookResponse: {},
    }));

    if (!schedulerDocs.length) {
      logger.warn(`No webhook configs found for clientId=${clientId}`);
      return;
    }

    const records = await WebhookCronScheduler.insertMany(schedulerDocs);

    logger.info(`Inserted ${records.length} records into scheduler`);

    // add apiKey to recently pushed docs
    const enrichedRecords = records.map((rec) => {
      const matchingConfig = configs.find(
        (c) => c.webhookUrl === rec.webhookUrl,
      );

      return {
        ...rec.toObject(),
        apiKey: matchingConfig?.apiKey,
      };
    });
    // initial processing
    processNotifications(enrichedRecords).catch((err) => {
      logger.error(
        `Immediate notification processing failed: ${JSON.stringify({ error: err.message, stack: err.stack })}`,
      );
    });

    logger.info(`Webhook processing completed for messageId=${messageId}`);
  } catch (err) {
    logger.error(`Error in consumeNotification: ${err.stack}`);
  }
};

module.exports = { consumer };
