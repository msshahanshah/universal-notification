const {
  verifyToken,
  generateTokens,
  TOKEN_TYPES,
} = require("../../helpers/jwt.helper");
const bcrypt = require("bcrypt");
const globalDatabaseManager = require("../utillity/mainDatabase");

const login = async (username, password) => {
  try {
    username = username.toLowerCase();
    const globalDb = await globalDatabaseManager.getModels();

    const user = await globalDb.User.findOne({
      where: { username: username },
    });

    if (!user) {
      throw { message: "Invalid username or password", statusCode: 401 };
    }

    // compare password
    const isCorrect = await bcrypt.compare(password, user.password);
    if (!isCorrect) {
      throw {
        message: "Incorrect username or password",
        statusCode: 401,
      };
    }

    const payload = { id: user.id, username: user.username };
    const { accessToken, refreshToken } = generateTokens(payload, {
      access: true,
      refresh: true,
    });

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
    const payload = verifyToken(refreshToken, TOKEN_TYPES.REFRESH);

    if (!payload) {
      throw { message: "Unauthorized", statusCode: 401 };
    }

    const globalDb = await globalDatabaseManager.getModels();

    const user = await globalDb.User.findOne({
      where: { username: payload.username },
    });

    if (!user) {
      throw { message: "user no longer exists", statusCode: 404 };
    }

    const newPayload = { id: user.id, username: user.username };
    const token = generateTokens(newPayload, { access: true });
    return token.accessToken;
  } catch (error) {
    throw { message: "invalid refresh token", statusCode: 401 };
  }
};

module.exports = { login, generateNewAccessToken };
