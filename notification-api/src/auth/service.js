const {
  verifyToken,
  generateTokens,
  TOKEN_TYPES,
} = require("../../helpers/jwt.helper");
const bcrypt = require("bcrypt");
const globalDatabaseManager = require("../utillity/mainDatabase");
const redisClient = require("../../config/redisClient");
const { AUTH_TOKEN } = require("../../constants/index");

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

    // adding access and refresh tokens in redis
    redisClient.set(AUTH_TOKEN.ACCESS_TOKEN_KEY, accessToken);
    redisClient.set(AUTH_TOKEN.REFRESH_TOKEN_KEY, refreshToken);

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
    const isRefreshTokenExistInRedis = await redisClient.get(
      AUTH_TOKEN.REFRESH_TOKEN_KEY,
    );

    if (!payload || !isRefreshTokenExistInRedis) {
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
    redisClient.set(AUTH_TOKEN.ACCESS_TOKEN_KEY, token.accessToken);
    return token.accessToken;
  } catch (error) {
    throw { message: "invalid refresh token", statusCode: 401 };
  }
};

module.exports = { login, generateNewAccessToken };
