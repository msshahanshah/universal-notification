const authService = require("./service");

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const { accessToken, refreshToken } = await authService.login(
      username,
      password
    );
    return res.status(200).json({
      message: "login successful",
      accessToken,
      refreshToken,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      message: err.message || "Internal Server Error",
    });
  }
};

const refresh = async (req, res) => {
  try {
    return await authService.generateNewAccessToken(req.body, refreshToken);
  } catch (err) {
    throw err;
  }
};

module.exports = {
  login,
  refresh,
};
