const { verifyToken, generateTokens } = require("../../helpers/jwt.helper");
const bcrypt = require("bcrypt");
const globalDatabaseManager = require("../utillity/mainDatabase");
const { AUTH_TOKEN } = require("../../constants/index.js");
const RedisHelper = require("../../helpers/redis.helper.js");

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

    const REDIS_ACCESS_TOKEN_KEY = RedisHelper.getAccessTokenRedisKey(username);
    const REDIS_REFRESH_TOKEN_KEY =
      RedisHelper.getRefreshTokenRedisKey(username);

    RedisHelper.setKey(REDIS_ACCESS_TOKEN_KEY, accessToken);
    RedisHelper.setKey(REDIS_REFRESH_TOKEN_KEY, refreshToken);

    return {
      accessToken,
      refreshToken,
    };
  } catch (err) {
    throw err;
  }
};

const generateNewAccessToken = async (refreshToken, x_clientId) => {
  try {
    const payload = verifyToken(refreshToken, AUTH_TOKEN.REFRESH_TOKEN);
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
    const userClient = username.split("@")[1];
    if (!userClient) {
      throw { statusCode: 401, message: `invalid username or password` };
    }
    if (userClient.toLowerCase() !== x_clientId.toLowerCase()) {
      throw { statusCode: 400, message: `invalid client_id ${x_clientId}` };
    }
    const REDIS_ACCESS_TOKEN_KEY = RedisHelper.getAccessTokenRedisKey(username);
    const REDIS_REFRESH_TOKEN_KEY =
      RedisHelper.getRefreshTokenRedisKey(username);

    const isRefreshTokenExistInRedis = await RedisHelper.getValue(
      REDIS_REFRESH_TOKEN_KEY,
    );
    if (!isRefreshTokenExistInRedis) {
      throw { message: "Unauthorized", statusCode: 401 };
    }

    const newPayload = { id: user.id, username: user.username };
    const token = generateTokens(newPayload, { access: true });
    RedisHelper.setKey(REDIS_ACCESS_TOKEN_KEY, token.accessToken);
    return token.accessToken;
  } catch (error) {
    throw {
      message: error.message || "Invalid refresh token",
      statusCode: error.statusCode || 401,
    };
  }
};

module.exports = { login, generateNewAccessToken };
