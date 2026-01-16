const Joi = require("joi");

const loginValidateSchema = Joi.object({
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
  .unknown(false)
  .messages({
    "object.base": "Request body must be a valid JSON object",
    "object.unknown": "Unknown field is not allowed",
  });

module.exports = loginValidateSchema;

// Middleware to validate the request
const loginValidateRequest = (req, res, next) => {
  // if (!req.body || Object.keys(req.body).length === 0) {
  //   return res.status(400).json({
  //     message: "Request body is required",
  //   });
  // }
  const { error } = loginValidateSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res
      .status(400)
      .json({ errors: error.details.map((err) => err.message) });
  }

  next();
};
module.exports = loginValidateRequest;
