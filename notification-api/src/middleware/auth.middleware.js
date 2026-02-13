const jwt = require("jsonwebtoken");
const { verifyToken, TOKEN_TYPES } = require("../../helpers/jwt.helper");
const globalDatabaseManager = require("../utillity/mainDatabase");
const redisClient = require("../../config/redisClient");
const { AUTH_TOKEN } = require("../../constants");
const RedisUtil = require("../utillity/redis");
const auth = async (req, res, next) => {
  try {
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

    const clientId = req.headers["x-client-id"];

    const REDIS_ACCESS_TOKEN_KEY = RedisUtil.getAccessTokenRedisKey(clientId);

    const isAccessTokenExistInRedis = await redisClient.get(
      REDIS_ACCESS_TOKEN_KEY,
    );

    if (!isAccessTokenExistInRedis) {
      throw {
        statusCode: 401,
        message: "Unauthorized ",
      };
    }
    const decodedData = verifyToken(token, TOKEN_TYPES.ACCESS);

    const globalDb = await globalDatabaseManager.getModels();

    const user = await globalDb.User.findOne({
      where: { username: decodedData.username },
    });

    if (!user) {
      throw { statusCode: 404, message: "User does not found" };
    }

    req.clientId = clientId;
    req.user = decodedData;
    next();
  } catch (error) {
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
