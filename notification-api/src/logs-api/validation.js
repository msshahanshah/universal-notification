const Joi = require('joi');
const {
  commonValidation,
  baseOptions,
} = require('../validators/common.validator');

const baseParams = Joi.string().optional().trim();

const validateLogsSchema = Joi.object({
  service: baseParams.messages({
    'string.base': 'Value of service must be a string',
    'string.empty': 'Value of service cannot be empty',
  }),
  status: baseParams.messages({
    'string.base': 'Value of status must be a string.',
    'string.empty': 'Value of status cannot be empty',
  }),
  page: commonValidation.page,
  limit: commonValidation.limit,
  order: baseParams.valid('asc', 'desc').messages({
    'string.base': 'Value of order must be string',
    'any.only': 'Value or order must be one of following: asc, desc',
    'string.empty': `Value of order can't be empty`,
  }),
  sort: baseParams.messages({
    'string.base': 'Value of sort must be string',
    'string.empty': `Value of sort can't be empty`,
  }),
  message: baseParams.messages({
    'string.base': 'Value of message must be string',
    'string.empty': `Value of message can't be empty`,
  }),

  destination: baseParams.messages({
    'string.base': 'Value of destination must be string',
    'string.empty': `Value of destination can't be empty`,
  }),

  // attempts: baseParams.messages({
  //   'string.base': 'Value of attempts must be string',
  //   'string.empty': `Value of attempts can't be empty`,
  // }),
  attempts: Joi.number()
  .integer()
  .min(0)
  .max(3)
  .optional()
  .messages({
    'number.base': 'Value of attempts must be number',
    'number.integer': 'Value of attempts must be integer',
    'number.min': 'Value of attempts must be >= 0',
    'number.max': 'Value of attempts must be <= 3',
  }),

  cc: baseParams.messages({
    'string.base': 'Value of cc must be string',
    'string.empty': `Value of cc can't be empty`,
  }),

  bcc: baseParams.messages({
    'string.base': 'Value of bcc must be string',
    'string.empty': `Value of bcc can't be empty`,
  }),

  fromEmail: baseParams.messages({
    'string.base': 'Value of fromEmail must be string',
    'string.empty': `Value of fromEmail can't be empty`,
  }),
  'start-time': Joi.date().iso().messages({
    'date.base': 'Value of start-time must be valid timestamp',
    'date.format': 'Value of start-time must be in ISO 8601 format (UTC)',
    'date.empty': `Value of start-time can't be empty`,
  }),

  'end-time': Joi.date().iso().optional().messages({
    'date.base': 'Value of end-time must be valid timestamp',
    'date.format': 'Value of end-time must be in ISO 8601 format (UTC)',
    'date.empty': `Value of end-time can't be empty`,
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
