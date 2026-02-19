const { AUTH_TOKEN } = require("../../constants/index");

class RedisUtil {
  static getAccessTokenRedisKey(username) {
    return AUTH_TOKEN.ACCESS_TOKEN_KEY + "-" + username;
  }

  static getRefreshTokenRedisKey(username) {
    return AUTH_TOKEN.REFRESH_TOKEN_KEY + "-" + username;
  }
}

module.exports = RedisUtil;
