const { AUTH_TOKEN } = require("../../constants/index");

class RedisUtil {
  static getAccessTokenRedisKey(clientId) {
    return AUTH_TOKEN.ACCESS_TOKEN_KEY + clientId;
  }

  static getRefreshTokenRedisKey(clientId) {
    return AUTH_TOKEN.REFRESH_TOKEN_KEY + clientId;
  }
}

module.exports = RedisUtil;
