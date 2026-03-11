const { createClient } = require("redis");
const logger = require("../logger");

const redisClient = createClient({
  url: process.env.REDIS_URL,
  disableOfflineQueue: true,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        console.log("Redis retry attempts exhausted");
        return false;
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

redisClient.on("ready", () => {
  logger.info("Redis ready");
});

redisClient.on("reconnecting", () => {
  logger.info("Redis reconnecting...");
});

redisClient.on("end", () => {
  logger.info("Redis connection closed");
});

redisClient.on("error", (error) => {
  logger.error("Redis error: ", {
    message: error.message,
    stack: error?.stack
  });
});

(async () => {
  try {
    await redisClient.connect();
    logger.info("Connected to Redis");
  } catch (error) {
    logger.error("ERROR: Failed to connect to Redis", {
      message: error.message,
      stack: error?.stack
    });
  }
})();

module.exports = redisClient;
