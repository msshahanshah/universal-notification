const jwt = require("jsonwebtoken");
require("dotenv").config();
const { AUTH_TOKEN } = require("../constants/index.js");

const tokenConfig = {
  [AUTH_TOKEN.ACCESS_TOKEN]: {
    secret: process.env.ACCESS_TOKEN_SECRET,
    expiresIn: process.env.ACCESS_TOKEN_TIME,
  },
  [AUTH_TOKEN.REFRESH_TOKEN]: {
    secret: process.env.REFRESH_TOKEN_SECRET,
    expiresIn: process.env.REFRESH_TOKEN_TIME,
  },
};

const signToken = (payload, type) => {
  const config = tokenConfig[type];
  if (!config) throw new Error("Invalid token type");

  return jwt.sign(payload, config.secret, {
    expiresIn: config.expiresIn,
  });
};

const verifyToken = (token, type) => {
  const config = tokenConfig[type];
  if (!config) throw new Error("Invalid token type");

  return jwt.verify(token, config.secret);
};

const generateTokens = (payload, options = { access: true, refresh: true }) => {
  const tokens = {};

  if (options.access) {
    tokens.accessToken = signToken(payload, AUTH_TOKEN.ACCESS_TOKEN);
  }

  if (options.refresh) {
    tokens.refreshToken = signToken(payload, AUTH_TOKEN.REFRESH_TOKEN);
  }
  return tokens;
};

module.exports = {
  signToken,
  verifyToken,
  generateTokens,
};
