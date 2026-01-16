const { User } = require("../../models");

const {
  generateAccessAndRefreshToken,
  generateAccessToken,
  verifyRefreshToken,
} = require("../../helpers/jwt.helper");
const { comparePassword } = require("../../helpers/hashing.helper");

const login = async (username, password) => {
  try {
    const user = await User.findOne({
      where: { username },
    });

    if (!user) {
      throw new { message: "Invalid username or password", statusCode: 401 }();
    }

    // compare password

    const payload = { id: user.id, username: user.username };
    const { accessToken, refreshToken } =
      generateAccessAndRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
    };
  } catch (err) {
    throw err;
  }
};

const generateNewAccessToken = async (refreshToken) => {
  try {
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new { error: "Unauthorized", statusCode: 401 }();
    }

    return { accessToken: generateAccessToken(payload) };
  } catch (error) {
    throw err;
  }
};

module.exports = { login, generateNewAccessToken };
