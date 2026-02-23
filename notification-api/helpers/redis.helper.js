const { AUTH_TOKEN } = require("../constants/index");
const redisClient = require("../src/utillity/redisClient");

const access_token_expire = process.env.ACCESS_TOKEN_TIME || "15M";
const refresh_token_expire = process.env.REFRESH_TOKEN_TIME || "7D";

function parseExpiryToSeconds(expiry) {
  const value = parseInt(expiry.slice(0, -1), 10);
  const unit = expiry.slice(-1).toUpperCase();

  switch (unit) {
    case "S":
      return value;
    case "M":
      return value * 60;
    case "H":
      return value * 60 * 60;
    case "D":
      return value * 60 * 60 * 24;
    default:
      throw new Error("Invalid expiry format. Use S, M, H, or D.");
  }
}

class RedisHelper {
  static async setKey(key, value, type) {
    try {
      const expiryString =
        type === AUTH_TOKEN.ACCESS_TOKEN
          ? access_token_expire
          : refresh_token_expire;

      const expiryInSeconds = parseExpiryToSeconds(expiryString);

      return await redisClient.set(key, value, {
        EX: expiryInSeconds,
      });
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

  static getAccessTokenRedisKey(username) {
    return AUTH_TOKEN.ACCESS_TOKEN + "-" + username;
  }

  static getRefreshTokenRedisKey(username) {
    return AUTH_TOKEN.REFRESH_TOKEN + "-" + username;
  }
}

module.exports = RedisHelper;
