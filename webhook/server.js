require("dotenv").config();

const logger = require("./utils/logger");
const { connectMongoose } = require("./helpers/mongoose.helper");
const { startGrpcServer } = require("./grpc/grpc.server");

/**
 * Cron Schedular
 */
require("./cron/webhookCron");

const start = async () => {
  try {
    await connectMongoose();
    startGrpcServer();
  } catch (err) {
    logger.error(`[WEBHOOK SERVICE] Server Stops ${err}`);
    process.exit(1);
  }
};

start();
