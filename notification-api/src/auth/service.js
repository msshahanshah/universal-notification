const { verifyToken, generateTokens } = require("../../helpers/jwt.helper");
const bcrypt = require("bcrypt");
const globalDatabaseManager = require("../utillity/mainDatabase");
const redisClient = require("../../config/redisClient");
const { TOKEN_TYPES } = require("../../constants/index.js");
const RedisUtil = require("../utillity/redis");

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

    const REDIS_ACCESS_TOKEN_KEY = RedisUtil.getAccessTokenRedisKey(username);
    const REDIS_REFRESH_TOKEN_KEY = RedisUtil.getRefreshTokenRedisKey(username);

    redisClient.set(REDIS_ACCESS_TOKEN_KEY, accessToken);
    redisClient.set(REDIS_REFRESH_TOKEN_KEY, refreshToken);

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
      throw { message: "User no longer exists", statusCode: 404 };
    }
    const username = user.username;
    const REDIS_ACCESS_TOKEN_KEY = RedisUtil.getAccessTokenRedisKey(username);
    const REDIS_REFRESH_TOKEN_KEY = RedisUtil.getRefreshTokenRedisKey(username);

    const isRefreshTokenExistInRedis = await redisClient.get(
      REDIS_REFRESH_TOKEN_KEY,
    );
    if (!isRefreshTokenExistInRedis) {
      throw { message: "Unauthorized", statusCode: 401 };
    }

    const newPayload = { id: user.id, username: user.username };
    const token = generateTokens(newPayload, { access: true });
    redisClient.set(REDIS_ACCESS_TOKEN_KEY, token.accessToken);
    return token.accessToken;
  } catch (error) {
    throw { message: "Invalid refresh token", statusCode: 401 };
  }
};

module.exports = { login, generateNewAccessToken };
