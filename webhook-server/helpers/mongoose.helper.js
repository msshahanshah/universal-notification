const mongoose = require("mongoose");
const webhook = require("../models/webhook");
const logger = require("../utils/logger");

let mongooseInstance = null;

const connectMongoose = async () => {
  if (mongooseInstance) {
    return mongooseInstance; // Return existing instance if already connected
  }

  try {
    mongooseInstance = await mongoose.connect(process.env.MONGO_URI);
    logger.info("MongoDB connected successfully");
    return mongooseInstance;
  } catch (err) {
    logger.error(`MongoDB connection error: ${JSON.stringify({ error: err.message, stack: err.stack })}`);
    throw err; // Rethrow error to handle it in the calling function
  }
};

const isUniqueConstraintError = (error) => {
  return error.code === 11000;
};

const findAllEnabledServicesForClient = async (clientId) => {
  const services = await webhook.find(
    { clientId, isActive: true, deletedAt: null },
    "serviceTrigger",
  );

  const uniqueService = [
    ...new Set(services.flatMap((item) => Object.keys(item.serviceTrigger))),
  ];

  return uniqueService;
};

module.exports = {
  connectMongoose,
  mongooseInstance,
  isUniqueConstraintError,
  findAllEnabledServicesForClient,
};
