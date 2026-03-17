const { CronJob } = require('cron');
const mongoose = require('mongoose');
const WebhookCronScheduler = require('../models/webhookCronSchedulerModel');
const WebhookLogs = require('../models/webhookLogsModel');
const logger = require('../utils/logger');

const axios = require('axios');
const { decrypt } = require('../utils/cryptoUtil');
const WebhookConfig = require('../models/webhook');

const getExpiredDocuments = async () => {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  const docs = await WebhookCronScheduler.find({
    updatedAt: { $lt: thirtyMinutesAgo },
  }).lean();
  return docs;
};

const decryptKey = (key) => {
  const decryptedKey = decrypt(key);
  return decryptedKey;
};

const callWebhook = async (url, payload, encryptedKey) => {
  try {
    console.log('URL', url);
    console.log('Payload', payload);
    console.log('encryptedKey', encryptedKey);

    // const token = decryptKey(encryptedKey);
    token = encryptedKey;
    console.log('Token', token);
    const response = await axios.post(url, payload, {
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    return {
      status: response.status, // value key will be 200 or 500 or any other by client, client should send this key in response
    };
  } catch (error) {
    return {
      status: error.status || 500, // in this case request is failed by us, it's our fault...
    };
  }
};

const callClientWebhooks = async () => {
  try {
    const allDocuments = await getExpiredDocuments();
    const success = [];
    const failed = [];

    logger.info(`Expired documents fetched successfully`);

    if (!allDocuments.length) {
      logger.info('No expired webhook documents found');
      return { success, failed };
    }

    const webhookUrls = allDocuments.map((doc) => doc.webhookUrl);
    const configs = await WebhookConfig.find(
      { webhookUrl: { $in: webhookUrls } },
      { webhookUrl: 1, encryptedKey: 1 },
    ).lean();

    const keyMap = new Map();

    configs.forEach((config) => {
      keyMap.set(config.webhookUrl, config.encryptedKey);
    });

    // create promise array
    let promiseArray = allDocuments.map((doc) => {
      const encryptedKey = keyMap.get(doc.webhookUrl);
      // if (!encryptedKey) {
      //   logger.info(
      //     `No encrypted key found for this documents skipping webhook call...`,
      //   );
      //   return;
      // }
      return callWebhook(
        doc.webhookUrl,
        doc.webhookPayload,
        // decryptKey(encryptedKey),
        'abcd',
      );
    });

    promiseArray = promiseArray.map((arr) => {
      if (arr !== undefined) {
        return arr;
      }
    });

    // run all promises
    const results = await Promise.allSettled(promiseArray);

    results.forEach((result, index) => {
      const doc = allDocuments[index];
      doc.result = result.value;

      if (
        result.value.status === 200 ||
        doc.retryAttempts + 1 >= process.env.MAX_RETRY_ATTEMPTS
      ) {
        success.push(doc);
      } else {
        failed.push(doc);
      }
    });

    return {
      success,
      failed,
    };
  } catch (error) {
    logger.error(`Error in calling client webhooks ${error.message}`);
    throw error;
  }
};

const cronJob = async () => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { success, failed } = await callClientWebhooks();
    const logs = success.map((doc) => {
      return {
        clientId: doc.clientId || 'GKMIT',
        webhookUrl: doc.webhookUrl,
        serviceTrigger: doc.serviceTrigger,
        status: 'success',
        retryAttempts: doc.retryAttempts + 1,
        webhookResponse: doc.result,
        webhookPayload: doc.webhookPayload,
      };
    });

    const deleteIds = success.map((doc) => doc._id);
    const updateIds = failed.map((doc) => doc._id);

    if (logs.length != 0) {
      const insertedLogs = await WebhookLogs.insertMany(logs);
      logger.info(`Logs inserted in webhookLogs table`);
      const deletedLogs = await WebhookCronScheduler.deleteMany({
        _id: { $in: deleteIds },
      });
      logger.info(`Logs deleted from webhookCronScheduler table`);
    }

    if (updateIds.length != 0) {
      const updatedIds = await WebhookCronScheduler.updateMany(
        { _id: { $in: updateIds } },
        { $inc: { retryAttempts: 1 } },
        { $set: { status: 'failed' } },
      );
      logger.info(
        `Updated documents in webhookCronScheduler table, (increasing retryAttempts by 1)`,
      );
    }
    logger.info(`Cron function completed`);
  } catch (err) {
    logger.error(`Error in cron function ${err.message}`);
  }
};

const job = new CronJob(
  '0 */30 * * * *', // every 10 seconds
  async function async() {
    logger.info(`Cron job is running...`);
    await cronJob();
  },
  () => {
    logger.info('Cron stopped successfully');
  },
  true, // start immediately
  'UTC',
);

job.start();
