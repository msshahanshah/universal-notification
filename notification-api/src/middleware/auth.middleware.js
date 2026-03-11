const jwt = require("jsonwebtoken");
const { verifyToken } = require("../../helpers/jwt.helper");
const globalDatabaseManager = require("../utillity/mainDatabase");

const { AUTH_TOKEN } = require("../../constants/index.js");
const RedisHelper = require("../../helpers/redis.helper.js");
const logger = require("../logger.js");

const auth = async (req, res, next) => {
  try {
    // get token from request
    let token = "";

    if (
      req.headers &&
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw {
        statusCode: 401,
        message: "Authorization denied: No token provided",
      };
    }

    const decodedData = verifyToken(token, AUTH_TOKEN.ACCESS_TOKEN);

    const username = decodedData.username;
    const REDIS_ACCESS_TOKEN_KEY = RedisHelper.getAccessTokenRedisKey(username);
    const tokenInRedis = await RedisHelper.getValue(REDIS_ACCESS_TOKEN_KEY);

    if (tokenInRedis !== token) {
      throw {
        statusCode: 401,
        message: "Invalid Token. Please Retry Login",
      };
    }

    const globalDb = await globalDatabaseManager.getModels();

    const user = await globalDb.User.findOne({
      where: { username: decodedData.username },
    });

    if (!user) {
      throw { statusCode: 404, message: "User does not found" };
    }

    req.user = decodedData;

    next();
  } catch (error) {
    logger.error({
      message: error.message,
      stack: error?.stack,
    });
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res
        .status(401)
        .json({ success: false, message: "Token is not valid or has expired" });
    }
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Token is not valid or has expired",
    });
  }
};

module.exports = auth;
