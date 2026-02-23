const { createClient } = require("redis");

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

(async () => {
  try {
    await redisClient.connect();
    console.log("Connected to Redis");
  } catch (err) {
    console.error("ERROR: Failed to connect to Redis", err.message);
  }
})();

module.exports = redisClient;
