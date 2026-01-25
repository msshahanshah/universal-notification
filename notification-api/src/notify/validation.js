const Joi = require('joi');
require('dotenv').config({
  path: require('path').resolve(__dirname, '../../../.env'),
});
// Define the validation schema

console.log(
  'Environment Variables:',
  require('path').resolve(__dirname, '../../../.env'),
);
// Default to all supported services if SERVICE env var is not set
const services = process.env.SERVICE
  ? process.env.SERVICE.split(',')
  : ['slack', 'email', 'sms'];

const ALLOWED_MIMETYPES = [
  'application/pdf',
  'image/x-png',
  'image/x-citrix-jpeg',
];

const extension_mimetype_map = {
  'application/pdf': 'pdf',
  'image/x-png': 'png',
  'image/x-citrix-jpeg': 'jpeg'
}

const validateSchema = Joi.object({
  service: Joi.string()
    .valid(...services)
    .required(),
  message: Joi.string().when('service', {
    is: 'email',
    then: Joi.forbidden(),
    otherwise: Joi.string().required().messages({
      'string.empty': 'Message is required',
    }),
  }),
  subject: Joi.string().when('service', {
    is: 'email',
    then: Joi.string().required().messages({
      'string.empty': 'Subject is required for Email service',
    }),
    otherwise: Joi.forbidden(),
  }),
  body: Joi.string().when('service', {
    is: 'email',
    then: Joi.string().required().messages({
      'string.empty': 'Body is required for Email service',
    }),
    otherwise: Joi.forbidden(),
  }),
  fromEmail: Joi.string().when('service', {
    is: 'email',
    then: Joi.string().email().required().messages({
      'string.empty': 'From email is required for Email service',
      'string.email': 'From email must be a valid email address',
    }),
    otherwise: Joi.forbidden(),
  }),
  destination: Joi.string()
    .custom((value, helpers) => {
      const service = helpers.state.ancestors[0].service;
      // Regex for single or comma-separated values (alphanumeric with optional underscores)
      const baseRegex = /^(\w+)(,\w+)*$/;

      if (service === 'slack') {
        if (!baseRegex.test(value)) {
          return helpers.message(
            'Destination must be a single Channel ID or comma-separated list of Channel IDs for Slack service',
          );
        }
      } else if (service === 'email') {
        const emailRegex = /^[\w.-]+@[\w.-]+\.\w+$/;
        const arr = value
          .trim()
          .split(',')
          .map((str) => {
            if (str !== '') {
              return str;
            }
          });
        let result = '';
        for (let i = 0; i < arr.length; i++) {
          if (typeof arr[i] === 'string' && arr[i].trim() !== '') {
            const email = arr[i].trim();
            if (emailRegex.test(email)) {
              result += email;
              result += ',';
            }
          }
        }

        if (result.length === 0) {
          return helpers.message('There is no valid email in destination.');
        }

        return result;
      } else if (service === 'sms') {
        // Regex for single or multiple phone numbers
        const smsRegex = /^(\+[1-9]\d{1,14})(,\+[1-9]\d{1,14})*$/;
        if (!smsRegex.test(value)) {
          return helpers.message(
            'Destination must be a single valid mobile number or comma-separated list of valid mobile numbers (e.g., +1234567890) for SMS service',
          );
        }
      }
      return value;
    })
    .required()
    .messages({
      'string.empty': 'Destination is required',
    }),

  cc: Joi.when('service', {
    is: 'email',
    then: Joi.string().custom((value, helpers) => {
      const emailRegex = /^[\w.-]+@[\w.-]+\.\w+$/;
      const arr = value
        .trim()
        .split(',')
        .map((str) => {
          if (str !== '') {
            return str;
          }
        });
      let result = '';
      for (let i = 0; i < arr.length; i++) {
        if (typeof arr[i] === 'string' && arr[i].trim() !== '') {
          const email = arr[i].trim();
          if (emailRegex.test(email)) {
            result += email;
            result += ',';
          }
        }
      }

      if (result.length === 0) {
        return helpers.message('There is no valid email in cc.');
      }

      return result;
    }),
    otherwise: Joi.forbidden(),
  }),

  bcc: Joi.when('service', {
    is: 'email',
    then: Joi.string().custom((value, helpers) => {
      const emailRegex = /^[\w.-]+@[\w.-]+\.\w+$/;
      const arr = value
        .trim()
        .split(',')
        .map((str) => {
          if (str !== '') {
            return str;
          }
        });
      let result = '';
      for (let i = 0; i < arr.length; i++) {
        if (typeof arr[i] === 'string' && arr[i].trim() !== '') {
          const email = arr[i].trim();
          if (emailRegex.test(email)) {
            result += email;
            result += ',';
          }
        }
      }

      if (result.length === 0) {
        return helpers.message('There is no valid email in bcc.');
      }

      return result;
    }),
    otherwise: Joi.forbidden(),
  }),
  attachments: Joi.when('service', {
    is: 'email',
    then: Joi.boolean().required().messages({
      'any.required': 'Attachments flag is required for Email service',
      'boolean.base': 'Attachments must be true or false',
    }),
    otherwise: Joi.forbidden(),
  }),
  mimetype: Joi.when('service', {
    is: 'email',
    then: Joi.when('attachments', {
      is: true,
      then: Joi.string()
        .valid(...ALLOWED_MIMETYPES)
        .required()
        .messages({
          'any.only':
            'Mimetype must be one of application/pdf: pdf,image/x-png: png,image/x-citrix-jpeg: jpeg',
          'any.required': 'Mimetype is required when attachments is true',
        }),
      otherwise: Joi.forbidden(),
    }),
    otherwise: Joi.forbidden(),
  }),
});

// Middleware to validate the request
const validateRequest = (req, res, next) => {
  const { error, value } = validateSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res
      .status(400)
      .json({ success: false, message: error.details[0].message });
  }
  req.body = value;
  req.body.extension = extension_mimetype_map[value.mimetype];
  next();
};
module.exports = validateRequest;
