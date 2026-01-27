const Joi = require("joi");
const authValidation = require("../validators/auth.validation");
const { baseOptions } = require("../validators/common.validator");

const loginSchema = Joi.object({
  username: authValidation.username,
  password: authValidation.password,
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
      success: false,
      message: error.details[0].message,
    });
  }

  req.body = value;
  next();
};

module.exports = {
  loginValidateRequest: validateRequest(loginSchema),
  refreshValidateRequest: validateRequest(refreshSchema),
};
