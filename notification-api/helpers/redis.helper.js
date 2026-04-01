const { AUTH_TOKEN } = require('../constants/index');
const redisClient = require('../src/utillity/redisClient');
const { verifyToken, generateTokens } = require('./jwt.helper');
const access_token_expire = process.env.ACCESS_TOKEN_TIME || '15M';
const refresh_token_expire = process.env.REFRESH_TOKEN_TIME || '7D';
const template_expire = process.env.TEMPLATE_TIME || '1D';
const globalDatabaseManager = require('../src/utillity/mainDatabase');
const logger = require('../src/logger');

function parseExpiryToSeconds(expiry) {
  const value = parseInt(expiry.slice(0, -1), 10);
  const unit = expiry.slice(-1).toUpperCase();

  switch (unit) {
    case 'S':
      return value;
    case 'M':
      return value * 60;
    case 'H':
      return value * 60 * 60;
    case 'D':
      return value * 60 * 60 * 24;
    default:
      throw new Error('Invalid expiry format. Use S, M, H, or D.');
  }
}

class RedisHelper {
  static async login(clientId, refreshToken, accessToken) {
    await redisClient.set(`refresh:${refreshToken}`, accessToken, {
      EX: parseExpiryToSeconds(refresh_token_expire),
    });

    await redisClient.set(`access:${accessToken}`, clientId, {
      EX: parseExpiryToSeconds(access_token_expire),
    });

    await redisClient.sAdd(`client:${clientId}:refreshTokens`, refreshToken);

    logger.info('Login stored');
  }

  static async logout(clientId, refreshToken) {
    // Step 1: get access token from refresh
    const accessToken = await redisClient.get(`refresh:${refreshToken}`);

    if (!accessToken) {
      throw {
        statusCode: 401,
        message: 'Invalid refresh token',
      };
    }

    if (accessToken) {
      // Step 2: delete access token
      await redisClient.del(`access:${accessToken}`);
    }

    // Step 3: delete refresh token
    await redisClient.del(`refresh:${refreshToken}`);

    // Step 4: remove from client set
    await redisClient.sRem(`client:${clientId}:refreshTokens`, refreshToken);

    logger.info('Logout successfully');
  }

  static async refreshAccess(clientId, refreshToken) {
    const oldAccess = await redisClient.get(`refresh:${refreshToken}`);

    if (!oldAccess) {
      throw {
        statusCode: 401,
        message: 'Invalid refresh token',
      };
    }

    const newAccess = await generateNewAccessToken(refreshToken, clientId);

    // Step 4: store new access token
    await redisClient.set(`access:${newAccess}`, clientId, {
      EX: parseExpiryToSeconds(access_token_expire),
    });

    // Step 5: update refresh -> new access
    await redisClient.set(`refresh:${refreshToken}`, newAccess, {
      EX: parseExpiryToSeconds(refresh_token_expire),
    });

    // Step 6: delete old access token
    // if request is send before access expire
    await redisClient.del(`access:${oldAccess}`);
    logger.info('access token refreshed successfully');
    return newAccess;
  }

  static async setKey(key, value, type) {
    try {
      const expiryString = type === AUTH_TOKEN.ACCESS_TOKEN ? access_token_expire : type === 'template' ? template_expire : refresh_token_expire;

      const expiryInSeconds = parseExpiryToSeconds(expiryString);

      return await redisClient.set(key, value, {
        EX: expiryInSeconds,
      });
    } catch (err) {
      throw {
        statusCode: 500,
        message: 'Internal Server Error',
        originalError: err.message,
      };
    }
  }

  static async sadd(key, values, expire) {
    try {
      const result = await redisClient.sAdd(key, ...values);

      if (expire) {
        await redisClient.expire(key, expire);
      }

      return result;
    } catch (err) {
      throw {
        statusCode: 500,
        message: 'Internal Server Error',
        originalError: err.message,
      };
    }
  }

  static async smembers(key) {
    try {
      const exists = await redisClient.exists(key);
      if (!exists) return [];

      return await redisClient.sMembers(key);
    } catch (err) {
      throw {
        statusCode: 500,
        message: 'Internal Server Error',
        originalError: err.message,
      };
    }
  }

  static async getValue(key) {
    try {
      return await redisClient.get(key);
    } catch (err) {
      throw {
        statusCode: 500,
        message: 'Internal Server Error',
        originalError: err.message,
      };
    }
  }
  static async deleteKey(key) {
    try {
      return await redisClient.del(key);
    } catch (err) {
      throw {
        statusCode: 500,
        message: 'Internal Server Error',
        originalError: err.message,
      };
    }
  }

  static getAccessTokenRedisKey(username) {
    return AUTH_TOKEN.ACCESS_TOKEN + '-' + username;
  }

  static getRefreshTokenRedisKey(username) {
    return AUTH_TOKEN.REFRESH_TOKEN + '-' + username;
  }
}

const generateNewAccessToken = async (refreshToken, x_clientId) => {
  try {
    const payload = verifyToken(refreshToken, AUTH_TOKEN.REFRESH_TOKEN);
    if (!payload) {
      throw { message: 'Unauthorized', statusCode: 401 };
    }

    const globalDb = await globalDatabaseManager.getModels();
    const user = await globalDb.User.findOne({
      where: { username: payload.username },
    });

    if (!user) {
      throw { message: 'User no longer exists', statusCode: 404 };
    }
    const username = user.username;
    const userClient = username.split('@')[1];
    if (!userClient) {
      throw { statusCode: 401, message: `Invalid refresh token` };
    }
    if (userClient.toLowerCase() !== x_clientId.toLowerCase()) {
      throw { statusCode: 401, message: `Invalid refresh token` };
    }
    const newPayload = { id: user.id, username: user.username };
    const token = generateTokens(newPayload, { access: true });

    return token.accessToken;
  } catch (error) {
    throw {
      message: error.message || 'Invalid refresh token',
      statusCode: error.statusCode || 401,
    };
  }
};
module.exports = RedisHelper;
