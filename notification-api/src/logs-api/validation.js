const Joi = require('joi');

const validateLogsSchema = Joi.object({
  service: Joi.string().valid('email', 'slack', 'sms').optional().messages({
    'any.only': 'Service must be one of: email, slack, sms.',
    'string.base': 'Service must be a string.',
    'string.empty': 'Service cannot be empty.',
  }),

  status: Joi.string().valid('pending', 'sent', 'failed').optional().messages({
    'any.only': 'Status must be one of: pending, sent, failed.',
    'string.base': 'Status must be a string.',
  }),

  page: Joi.number().integer().min(1).optional().messages({
    'number.base': 'Page must be a number.',
    'number.integer': 'Page must be an integer.',
    'number.min': 'Page must be at least 1.',
  }),

  limit: Joi.number().integer().min(1).max(100).optional().messages({
    'number.base': 'Limit must be a number.',
    'number.integer': 'Limit must be an integer.',
    'number.min': 'Limit must be at least 1.',
    'number.max': 'Limit cannot exceed 100.',
  }),
});

const validateLogsQuery = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.query, {
    abortEarly: false,
    convert: true,
  });

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
