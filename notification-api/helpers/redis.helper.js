const { AUTH_TOKEN } = require("../constants/index");
const redisClient = require("../src/utillity/redisClient");
class RedisHelper {
  static async setKey(key, value) {
    await redisClient.set(key, value);
  }

  static async getValue(key) {
    return await redisClient.get(key);
  }
  static async deleteKey(key) {
    await redisClient.del(key);
  }

  static getAccessTokenRedisKey(username) {
    return AUTH_TOKEN.ACCESS_TOKEN + "-" + username;
  }

  static getRefreshTokenRedisKey(username) {
    return AUTH_TOKEN.REFRESH_TOKEN + "-" + username;
  }
}

module.exports = RedisHelper;
