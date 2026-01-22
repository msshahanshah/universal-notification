const Joi = require("joi");

const authValidation = {
  username: Joi.string()
    .trim()
    .min(3)
    .max(30)
    .pattern(/^[A-Za-z]{3,10}@[A-Za-z]{3,5}$/)
    .required()
    .messages({
      "string.base": "Username must be a string",
      "string.empty": "Username cannot be empty",
      "string.min": "Username must be at least 3 characters long",
      "string.max": "Username must not exceed 30 characters",
      "string.pattern.base":
        "Username must be in format: letters(3-10)@letters(3-5)",
      "any.required": "Username is required",
    }),

  password: Joi.string().min(8).max(12).required().messages({
    "string.base": "Password must be a string",
    "string.empty": "Password cannot be empty",
    "string.min": "Password must be at least 8 characters long",
    "string.max": "Password must not exceed 12 characters",
    "any.required": "Password is required",
  }),
};

module.exports = authValidation;
