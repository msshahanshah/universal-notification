const redisClient = require("../../config/redisClient");
const { AUTH_TOKEN } = require("../../constants");
const authService = require("./service");
const RedisUtil = require("../utillity/redis");
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const { accessToken, refreshToken } = await authService.login(
      username,
      password,
    );

    return res.status(200).json({
      success: true,
      message: "login successful",
      data: {
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    const newAccessToken =
      await authService.generateNewAccessToken(refreshToken);
    return res.status(200).json({
      success: true,
      message: "refresh successful",
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const logout = async (req, res) => {
  try {
    // remove access and refresh token from redis
    const username = req.user.username;

    const REDIS_ACCESS_TOKEN_KEY = RedisUtil.getAccessTokenRedisKey(username);
    const REDIS_REFRESH_TOKEN_KEY = RedisUtil.getRefreshTokenRedisKey(username);

    redisClient.del(REDIS_REFRESH_TOKEN_KEY);
    redisClient.del(REDIS_ACCESS_TOKEN_KEY);
    return res.status(200).send({
      success: true,
      message: "Logout Successfully",
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

module.exports = {
  login,
  refresh,
  logout,
};
