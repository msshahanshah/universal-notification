const authService = require("./service");
const RedisHelper = require("../../helpers/redis.helper");
const logger = require("../logger");
const { verifyToken } = require("../../helpers/jwt.helper");
const { AUTH_TOKEN } = require("../../constants");

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const x_clientId = req.headers["x-client-id"];
    const userClient = username.split("@")[1];

    if (!userClient) {
      throw { statusCode: 401, message: `invalid username or password` };
    }

    if (userClient.toLowerCase() !== x_clientId.toLowerCase()) {
      throw { statusCode: 401, message: `invalid username or password` };
    }
    const { accessToken, refreshToken } = await authService.login(
      x_clientId,
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
      stack: err?.stack,
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


    const newAccessToken = await RedisHelper.refreshAccess(x_clientId, refreshToken)
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
      stack: err?.stack,
    });
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const x_clientId = req.headers["x-client-id"];

    const payload = verifyToken(refreshToken, AUTH_TOKEN.REFRESH_TOKEN);
    const { username } = payload;
    const client = username.split("@")[1];

    if (client.toLowerCase() !== x_clientId.toLowerCase()) {
      throw {
        statusCode: 401,
        message: "Invalid refresh token"
      }
    }
    await RedisHelper.logout(x_clientId, refreshToken);
    return res.status(200).send({
      success: true,
      message: "Logout successfully",
    });
  } catch (err) {
    logger.error({
      message: err.message,
      stack: err?.stack,
    });
    if (
      err.name === "JsonWebTokenError" ||
      err.name === "TokenExpiredError"
    ) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid refresh token" });
    }
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
