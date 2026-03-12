const redisClient = require("../src/utillity/redisClient");

class RedisHelper {
  static async setKey(key, value) {
    try {
      return await redisClient.set(key, value);
    } catch (err) {
      console.log(err.message);
      throw {
        statusCode: 500,
        message: "Redis Client is Offline",
        originalError: err.message,
      };
    }
  }

  static async getValue(key) {
    try {
      return await redisClient.get(key);
    } catch (err) {
      throw {
        statusCode: 500,
        message: "Redis Client is Offline",
        originalError: err.message,
      };
    }
  }
  static async deleteKey(key) {
    try {
      return await redisClient.del(key);
    } catch (err) {
      throw {
        statusCode: 500,
        message: "Redis Client is Offline",
        originalError: err.message,
      };
    }
  }

  static generateWebhookKey(clientId) {
    return "webhook" + "#" + clientId;
  }
}

module.exports = RedisHelper;
