const Joi = require("joi");
const {
  commonValidation,
  baseOptions,
} = require("../validators/common.validator");

const validateLogsSchema = Joi.object({
  service: Joi.string().optional().valid("email", "slack", "sms").messages({
    "string.base": "Service must be a string",
    "any.only": "Service must be one of: email, slack, sms",
    "string.empty": "Service cannot be empty",
  }),
  status: Joi.string()
    .valid("pending", "sent", "failed", "processing")
    .optional()
    .messages({
      "any.only": "Status must be one of: pending, sent, failed , processing .",
      "string.base": "Status must be a string.",
    }),
  page: commonValidation.page,
  limit: commonValidation.limit,
});

const validateLogsQuery = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.query, baseOptions);

  if (error) {
    const err = error.details[0].message;
    return res.status(400).json({
      success: false,
      message: err,
    });
  }
  req.query = value;

  next();
};

module.exports = { validateLogsQuery: validateLogsQuery(validateLogsSchema) };
