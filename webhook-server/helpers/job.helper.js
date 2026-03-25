require("dotenv").config();

const WebhookCronScheduler = require("../models/webhookCronSchedulerModel");
const WebhookLog = require("../models/webhookLogsModel");

const logger = require("../utils/logger");

const handleFailure = async (msg, errorData, maxRetryAttempts = 4) => {
  const nextAttempt = msg.retryAttempts + 1;

  if (nextAttempt >= maxRetryAttempts) {
    await WebhookLog.create({
      clientId: msg.clientId,
      webhookUrl: msg.webhookUrl,
      serviceTrigger: msg.serviceTrigger,
      status: "failed",
      retryAttempts: nextAttempt,
      webhookPayload: msg.webhookPayload,
      webhookResponse: errorData,
    });

    await WebhookCronScheduler.deleteOne({ _id: msg._id });

    logger.error(
      `Max retries reached. Moved to logs: ${msg._id}, attempts=${nextAttempt}`,
    );
  } else {
    //  Retry
    await WebhookCronScheduler.updateOne(
      { _id: msg._id },
      {
        $inc: { retryAttempts: 1 },
        $set: {
          status: "failed",
          webhookResponse: errorData,
        },
      },
    );

    logger.warn(`Retry scheduled: ${msg._id}, attempts=${nextAttempt}`);
  }
};

const processNotifications = async (messages, maxRetryAttempts = 4) => {
  try {
    logger.info(`Processing ${messages.length} webhook messages`);

    const results = await Promise.allSettled(
      messages.map((msg) => {
        logger.info(`Calling webhook: ${msg.webhookUrl}`);

        return fetch(msg.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg.webhookPayload),
        });
      }),
    );

    const operations = results.map(async (result, index) => {
      const msg = messages[index];

      // HANDLE SUCCESSFUL FETCH (but still check HTTP status)
      if (result.status === "fulfilled") {
        const res = result.value;
        const responseText = await res.text().catch(() => "");

        logger.info(
          `Webhook success: ${msg.webhookUrl}, statusCode=${res.status}`,
        );

        // Move to logs
        await WebhookLog.create({
          clientId: msg.clientId,
          webhookUrl: msg.webhookUrl,
          serviceTrigger: msg.serviceTrigger,
          status: "success",
          retryAttempts: msg.retryAttempts,
          webhookPayload: msg.webhookPayload,
          webhookResponse: {
            statusCode: res.status,
            body: responseText,
          },
        });

        await WebhookCronScheduler.deleteOne({ _id: msg._id });

        logger.info(`Moved to logs & deleted from scheduler: ${msg._id}`);
      } else {
        // NETWORK FAILURE
        const errorMsg = result.reason?.message || "Unknown error";

        logger.error(
          `Webhook failed (network): ${msg.webhookUrl}, error=${errorMsg}`,
        );

        return handleFailure(msg, { error: errorMsg });
      }
    });

    await Promise.all(operations);

    logger.info(`Finished processing webhook batch`);
  } catch (err) {
    logger.error(`Error in processing notifications: ${err.stack}`);
    throw err;
  }
};

const findAllEligibleNotifications = async (
  window = 30, // minutes
  maxRetryAttempt = 4,
  time = new Date(),
) => {
  // Calculate cutoff time
  const cutoffTime = new Date(time.getTime() - window * 60 * 1000);

  console.log("cutoffTime>>", cutoffTime);

  const data = await WebhookCronScheduler.find({
    retryAttempts: { $lte: maxRetryAttempt }, // strictly less
    updatedAt: { $lte: new Date(cutoffTime) }, // older than window
  });

  return data;
};

module.exports = { processNotifications, findAllEligibleNotifications };
