const Joi = require("joi");

const authValidation = {
  username: Joi.string()
    .trim()
    .required()
    .messages({
      "string.base": "Username must be a string",
      "string.empty": "Username cannot be empty",
      "any.required": "Username is required",
    }),

  password: Joi.string()
    .trim()
    .required()
    .messages({
      "string.base": "Password must be a string",
      "string.empty": "Password cannot be empty",
      "any.required": "Password is required",
    }),
};

module.exports = authValidation;
