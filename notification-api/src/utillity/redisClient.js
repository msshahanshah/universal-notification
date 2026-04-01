const { createClient } = require('redis');
const logger = require('../logger');

const redisClient = createClient({
  url: process.env.REDIS_URL,
  disableOfflineQueue: true,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        logger.info('[REDIS] Redis retry attempts exhausted');
        return false;
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

redisClient.on('ready', () => {
  logger.info('[REDIS] Redis ready');
});

redisClient.on('reconnecting', () => {
  logger.info('[REDIS] Redis reconnecting...');
});

redisClient.on('end', () => {
  logger.info('[REDIS] Redis connection closed');
});

redisClient.on('error', (error) => {
  logger.error('[REDIS] Redis error: ', {
    message: error.message,
    stack: error?.stack,
  });
});

(async () => {
  try {
    logger.info(`[REDIS] connecting to redis. URL: ${process.env.REDIS_URL}`);
    await redisClient.connect();
    logger.info('[REDIS] Connected to Redis');
  } catch (error) {
    logger.error('ERROR: Failed to connect to Redis', {
      message: error.message,
      stack: error?.stack,
    });
  }
})();

module.exports = redisClient;
