const Joi = require('joi');
const {
  commonValidation,
  baseOptions,
} = require('../validators/common.validator');

const baseParams = Joi.string().optional().trim();

const validateLogsSchema = Joi.object({
  service: Joi.string().optional().valid('email', 'slack', 'sms').messages({
    'string.base': 'Service must be a string',
    'any.only': 'Service must be one of: email, slack, sms',
    'string.empty': 'Service cannot be empty',
  }),
  status: Joi.string()
    .valid('pending', 'sent', 'failed', 'processing')
    .optional()
    .messages({
      'any.only': 'Status must be one of: pending, sent, failed , processing .',
      'string.base': 'Status must be a string.',
    }),
  page: commonValidation.page,
  limit: commonValidation.limit,
  order: baseParams.valid('asc', 'desc').messages({
    'string.base': 'order must be string',
    'any.only': 'Order must be one of following: asc, desc',
    'string.empty': `Value of order can't be empty`
  }),
  sort: baseParams.messages({
    'string.base': 'Value of sort must be string',
    'string.empty': `Value of sort can't be empty`
  }),
  message: baseParams.messages({
    'string.base': 'Value of message must be string',
    'string.empty': `Value of message can't be empty`
  }),

  destination: baseParams.messages({
    'string.base': 'Value of destination must be string',
    'string.empty': `Value of destination can't be empty`
  }),

  attempts: baseParams.messages({
    'number.base': 'Value of attempts must be string',
    'string.empty': `Value of attempts can't be empty`
  }),

  cc: baseParams.messages({
    'string.base': 'Value of cc must be string',
    'string.empty': `Value of cc can't be empty`,
  }),

  bcc: baseParams.messages({
    'stirng.base': 'Value of bcc must be string',
    'string.empty': `Value of bcc can't be empty`
  }),

  fromEmail: baseParams.messages({
    'string.base': 'Value of from-email must be string',
    'string.empty': `Value of fromEmail can't be empty`
  }),
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
