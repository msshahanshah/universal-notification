const redisClient = require("../src/utility/redisClient");

class RedisHelper {
  static async setKey(key, value, type) {
    try {
      return await redisClient.set(key, value);
    } catch (err) {
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
}

module.exports = RedisHelper;
