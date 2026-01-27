const Joi = require("joi");
const baseOptions = { abortEarly: false, stripUnknown: false };
const commonValidation = {
  page: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      "number.base": "Page must be a number",
      "number.integer": "Page must be an integer",
      "number.min": "Page must be at least 1",
    }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .messages({
      "number.base": "Limit must be a number",
      "number.integer": "Limit must be an integer",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 100",
    }),
  service: Joi.string()
    .valid("email", "slack", "sms")
    .optional()
    .messages({
      "string.base": "Service must be a string",
      "any.only": "Service must be one of: email, slack, sms",
      "string.empty": "Service cannot be empty",
    }),
  message: Joi.string()
    .trim()
    .when("service", {
      is: "email",
      then: Joi.forbidden().messages({
        "any.unknown": "Message is not allowed for email service",
      }),
      otherwise: Joi.required().messages({
        "string.base": "Message must be a string",
        "string.empty": "Message cannot be empty",
        "any.required": "Message is required for this service",
      }),
    }),
};
module.exports = { commonValidation, baseOptions };
