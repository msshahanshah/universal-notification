const redisClient = require("../../config/redisClient");
const { AUTH_TOKEN } = require("../../constants");
const authService = require("./service");

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
    redisClient.del(AUTH_TOKEN.ACCESS_TOKEN_KEY);
    redisClient.del(AUTH_TOKEN.REFRESH_TOKEN_KEY);
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
