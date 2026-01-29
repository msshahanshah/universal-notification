const Joi = require("joi");
const {
  commonValidation,
  baseOptions,
} = require("../validators/common.validator");

const validateLogsSchema = Joi.object({
  service: commonValidation.service,
  status: Joi.string()
    .valid("pending", "sent", "failed", "processing")
    .optional()
    .messages({
      "any.only": "Status must be one of: pending, sent, failed.",
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
