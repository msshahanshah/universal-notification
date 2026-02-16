const jwt = require("jsonwebtoken");
const { verifyToken } = require("../../helpers/jwt.helper");
const globalDatabaseManager = require("../utillity/mainDatabase");
const redisClient = require("../../config/redisClient");
const { TOKEN_TYPES } = require("../../constants/index.js");
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

    const decodedData = verifyToken(token, TOKEN_TYPES.ACCESS);

    const globalDb = await globalDatabaseManager.getModels();

    const user = await globalDb.User.findOne({
      where: { username: decodedData.username },
    });

    if (!user) {
      throw { statusCode: 404, message: "User does not found" };
    }

    //chceking if token present in redis

    const username = user.username;
    const REDIS_ACCESS_TOKEN_KEY = RedisUtil.getAccessTokenRedisKey(username);
    const isAccessTokenExistInRedis = await redisClient.get(
      REDIS_ACCESS_TOKEN_KEY,
    );

    if (!isAccessTokenExistInRedis) {
      throw {
        statusCode: 401,
        message: "Unauthorized ",
      };
    }

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
