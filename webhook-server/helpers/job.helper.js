require("dotenv").config();

const WebhookCronScheduler = require("../models/webhookCronSchedulerModel");
const WebhookLog = require("../models/webhookLogsModel");
const { decrypt } = require("../utils/cryptoUtil");

const logger = require("../utils/logger");

const handleFailure = async (msg, errorData, maxRetryAttempts = 4) => {
  const currentAttempt = msg.retryAttempts; // already incremented

  if (currentAttempt >= maxRetryAttempts) {
    await WebhookLog.create({
      clientId: msg.clientId,
      webhookUrl: msg.webhookUrl,
      serviceTrigger: msg.serviceTrigger,
      apiKey: msg.apiKey,
      status: "failed",
      retryAttempts: currentAttempt,
      webhookPayload: msg.webhookPayload,
      webhookResponse: errorData,
    });

    await WebhookCronScheduler.deleteOne({ _id: msg._id });

    logger.error(
      `Max retries reached. Moved to logs: ${msg._id}, attempts=${currentAttempt}`,
    );
  } else {
    await WebhookCronScheduler.updateOne(
      { _id: msg._id },
      {
        $set: {
          status: "failed",
          webhookResponse: errorData,
        },
      },
    );

    logger.warn(`Retry scheduled: ${msg._id}, attempts=${currentAttempt}`);
  }
};

const processNotifications = async (messages, maxRetryAttempts = 4) => {
  try {
    logger.info(`Processing ${messages.length} webhook messages`);

    // step 1: update retryAttempts
    await WebhookCronScheduler.bulkWrite(
      messages.map((msg) => ({
        updateOne: {
          filter: {
            _id: msg._id,
            status: { $ne: "processing" },
          },
          update: {
            $inc: { retryAttempts: 1 },
            $set: { status: "processing" },
          },
        },
      })),
    );

    // step 2: call webhook
    const results = await Promise.allSettled(
      messages.map((msg) => {
        logger.info(`Calling webhook: ${msg.webhookUrl}`);

        return fetch(msg.webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": decrypt(msg.apiKey),
          },
          body: JSON.stringify({
            webhookUrl: msg.webhookUrl,
            status: msg.status,
            serviceTrigger: msg.serviceTrigger,
            retryAttempts: msg.retryAttempts,
            webhookPayload: msg.webhookPayload,
            webhookResponse: msg.webhookResponse,
            apiKey: msg?.apiKey,
          }),
        });
      }),
    );

    // STEP 3: Handle results
    const operations = results.map(async (result, index) => {
      const msg = messages[index];

      if (result.status === "fulfilled") {
        const res = result.value;
        const responseText = await res.text().catch(() => "");

        logger.info(
          `Webhook success: ${msg.webhookUrl}, statusCode=${res.status}`,
        );

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
        const errorMsg = result.reason?.message || "Unknown error";

        logger.error(
          `Webhook failed (network): ${msg.webhookUrl}, error=${errorMsg}`,
        );

        return handleFailure(msg, { error: errorMsg }, maxRetryAttempts);
      }
    });

    await Promise.all(operations);

    logger.info(`Finished processing webhook batch`);
  } catch (err) {
    logger.error(`Error in processing notifications: ${err.stack}`);
  }
};

const findAllEligibleNotifications = async (
  window = 30,
  maxRetryAttempt = 4,
  time = new Date(),
) => {
  const cutoffTime = new Date(time.getTime() - window * 60 * 1000);

  const data = await WebhookCronScheduler.aggregate([
    {
      $match: {
        retryAttempts: { $lte: maxRetryAttempt },
        updatedAt: { $lte: cutoffTime },
      },
    },
    {
      $lookup: {
        from: "webhookconfigs",
        let: {
          clientId: "$clientId",
          webhookUrl: "$webhookUrl",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$clientId", "$$clientId"] },
                  { $eq: ["$webhookUrl", "$$webhookUrl"] },
                  { $eq: ["$isActive", true] },

                  {
                    $or: [
                      { $eq: ["$deletedAt", null] },
                      { $not: ["$deletedAt"] },
                    ],
                  },
                ],
              },
            },
          },
          {
            $project: {
              apiKey: 1,
              _id: 0,
            },
          },
        ],
        as: "config",
      },
    },
    {
      $unwind: {
        path: "$config",
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $addFields: {
        apiKey: "$config.apiKey",
      },
    },
    {
      $project: {
        config: 0,
      },
    },
  ]);

  return data;
};

module.exports = { processNotifications, findAllEligibleNotifications };
