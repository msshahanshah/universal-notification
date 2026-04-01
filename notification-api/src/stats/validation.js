const Joi = require('joi');

const { SERVICE_PROVIDERS } = require('../../constants');

const querySchema = Joi.object({
  service: Joi.string().trim().valid('email', 'slack', 'sms', 'whatsapp').messages({
    'string.base': 'Service must be a string',
    'any.only': 'Service value is not acceptable',
  }),
  provider: Joi.string()
    .trim()
    .valid(...SERVICE_PROVIDERS.SMS)
    .messages({
      'any.only': 'provider is not valid.',
      'string.base': 'Provider must be a string',
    }),
});

const validateQueryRequest = (req, res, next) => {
  try {
    const { error, value } = querySchema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    req.query = value;
    next();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

module.exports = validateQueryRequest;
