const authService = require("./service");
const RedisHelper = require("../../helpers/redis.helper");
const logger = require("../logger");
const { stack } = require("sequelize/lib/utils");
const { error } = require("winston");
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const x_clientId = req.headers["x-client-id"];
    const userClient = username.split("@")[1];

    if (!userClient) {
      throw { statusCode: 400, message: `invalid username or password` };
    }

    if (userClient.toLowerCase() !== x_clientId.toLowerCase()) {
      throw { statusCode: 400, message: `invalid username or password` };
    }
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
    logger.error({
      message: err.message,
      stack: err?.stack
    });
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const x_clientId = req.headers["x-client-id"];
    const newAccessToken = await authService.generateNewAccessToken(
      refreshToken,
      x_clientId,
    );
    return res.status(200).json({
      success: true,
      message: "refresh successful",
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (err) {
    logger.error({
      message: err.message,
      stack: err?.stack
    });
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

    const REDIS_ACCESS_TOKEN_KEY = RedisHelper.getAccessTokenRedisKey(username);
    const REDIS_REFRESH_TOKEN_KEY =
      RedisHelper.getRefreshTokenRedisKey(username);

    await Promise.all([
      RedisHelper.deleteKey(REDIS_REFRESH_TOKEN_KEY),
      RedisHelper.deleteKey(REDIS_ACCESS_TOKEN_KEY),
    ]);

    return res.status(200).send({
      success: true,
      message: "Logout successfully",
    });
  } catch (err) {
    logger.error({
      message: err.message,
      stack: err?.stack
    });
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
