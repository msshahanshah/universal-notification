const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL,
  disableOfflineQueue: false,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        return new Error("Redis retry attempts exhausted");
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

redisClient.on("error", (err) => {
  throw { statusCode: 500, message: "Redis Client Offline" };
});

(async () => {
  await redisClient.connect();
  console.log("Connected to Redis");
})();

module.exports = redisClient;
