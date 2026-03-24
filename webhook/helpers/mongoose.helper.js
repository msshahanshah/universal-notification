const mongoose = require("mongoose");
const webhook = require("../models/webhook");

let mongooseInstance = null;

const connectMongoose = async () => {
  if (mongooseInstance) {
    return mongooseInstance; // Return existing instance if already connected
  }

  try {
    mongooseInstance = await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");
    return mongooseInstance;
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
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
