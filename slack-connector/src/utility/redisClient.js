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

redisClient.on("ready", () => {
  console.log("Redis ready");
});

redisClient.on("reconnecting", () => {
  console.log("Redis reconnecting...");
});

redisClient.on("end", () => {
  console.log("Redis connection closed");
});

redisClient.on("error", (err) => {
  console.log("Redis error: ", err.message);
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
