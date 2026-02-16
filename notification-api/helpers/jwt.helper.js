const jwt = require("jsonwebtoken");
require("dotenv").config();
const { TOKEN_TYPES } = require("../constants/index.js");

const tokenConfig = {
  [TOKEN_TYPES.ACCESS]: {
    secret: process.env.ACCESS_TOKEN_SECRET,
    expiresIn: process.env.ACCESS_TOKEN_TIME,
  },
  [TOKEN_TYPES.REFRESH]: {
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
    tokens.accessToken = signToken(payload, TOKEN_TYPES.ACCESS);
  }

  if (options.refresh) {
    tokens.refreshToken = signToken(payload, TOKEN_TYPES.REFRESH);
  }
  return tokens;
};

module.exports = {
  TOKEN_TYPES,
  signToken,
  verifyToken,
  generateTokens,
};
