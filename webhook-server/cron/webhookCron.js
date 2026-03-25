const { CronJob } = require("cron");
const {
  findAllEligibleNotifications,
  processNotifications,
} = require("../helpers/job.helper");
const logger = require("../utils/logger");

const SCHEDULAR_WINDOW =
  Number.parseInt(process.env.SCHEDULAR_WINDOW, 10) || 30; // minutes
let isJobRunning = false;

const job = new CronJob(`*/${SCHEDULAR_WINDOW} * * * *`, async () => {
  if (isJobRunning) {
    logger.warn("SCHEDULAR: Previous job still running, skipping...");
    return;
  }

  isJobRunning = true;

  try {
    logger.info(`SCHEDULAR: finding all eligible records...`);

    const records = await findAllEligibleNotifications(SCHEDULAR_WINDOW);

    logger.info(`SCHEDULAR: ${records.length} records found`);

    if (!records.length) {
      logger.info(`SCHEDULAR: No records to process`);
      return;
    }

    logger.info(`SCHEDULAR: Processing started...`);

    await processNotifications(records);

    logger.info(`SCHEDULAR: Processing completed`);
  } catch (error) {
    logger.error(`SCHEDULAR: job failed. ERROR: ${error.stack}`);
  } finally {
    isJobRunning = false;
  }
});

job.start();
