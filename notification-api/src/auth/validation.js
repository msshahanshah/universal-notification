const Joi = require("joi");

const baseOptions = {
  abortEarly: false,
  stripUnknown: true,
};

const loginSchema = Joi.object({
  username: Joi.string().trim().min(3).max(30).required().messages({
    "string.base": "Username must be a string",
    "string.empty": "Username cannot be empty",
    "string.min": "Username must be at least 3 characters long",
    "string.max": "Username must not exceed 30 characters",
    "any.required": "Username is required",
  }),

  password: Joi.string().min(8).max(128).required().messages({
    "string.base": "Password must be a string",
    "string.empty": "Password cannot be empty",
    "string.min": "Password must be at least 8 characters long",
    "string.max": "Password must not exceed 128 characters",
    "any.required": "Password is required",
  }),
})
  .required()
  .unknown(false);

const refreshSchema = Joi.object({
  refreshToken: Joi.string().trim().required().messages({
    "string.empty": "Refresh token cannot be empty",
    "any.required": "Refresh token is required",
  }),
})
  .required()
  .unknown(false);

const validateRequest = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, baseOptions);

  if (error) {
    return res.status(400).json({
      errors: error.details.map((err) => err.message),
    });
  }

  // sanitized payload
  req.body = value;
  next();
};

module.exports = {
  loginValidateRequest: validateRequest(loginSchema),
  refreshValidateRequest: validateRequest(refreshSchema),
};
