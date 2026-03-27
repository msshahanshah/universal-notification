const { verifyToken, generateTokens } = require("../../helpers/jwt.helper");
const bcrypt = require("bcrypt");
const globalDatabaseManager = require("../utillity/mainDatabase");
const { AUTH_TOKEN } = require("../../constants/index.js");
const RedisHelper = require("../../helpers/redis.helper.js");

const login = async (clientId, username, password) => {
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
        message: "Invalid username or password",
        statusCode: 401,
      };
    }

    const payload = { id: user.id, username: user.username };
    const { accessToken, refreshToken } = generateTokens(payload, {
      access: true,
      refresh: true,
    });


    await RedisHelper.login(
      clientId,
      refreshToken,
      accessToken
    )

    return {
      accessToken,
      refreshToken,
    };
  } catch (err) {
    throw err;
  }
};

module.exports = { login };
