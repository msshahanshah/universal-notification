const Joi = require('joi');
const { PhoneNumberUtil } = require('google-libphonenumber');
const phoneUtil = PhoneNumberUtil.getInstance();
const { phonenNumberRegex } = require('../../helpers/regex.helper');
const { validateWhatsAppAttachements } = require('./common.validator');

const whatsappTemplateRegex = /^HX[a-f0-9]{32}$/;
const whatsAppValidation = {
  destination: Joi.string()
    .required()
    .custom((value, helpers) => {
      // Split by comma
      let numbers = value.split(',');

      // Trim & remove empty values
      numbers = numbers.map((n) => n.trim());

      //checking extra commas
      for (let number of numbers) {
        if (number.length == 0)
          return helpers.message(
            `In destination empty commas are not allowed `,
          );
      }

      // If after cleanup nothing remains
      if (numbers.length === 0) {
        return helpers.message('At least one phone number is required');
      }

      // Validate each number
      for (const number of numbers) {
        if (!phonenNumberRegex.test(number)) {
          return helpers.message('Invalid phone number ');
        }

        try {
          // Parse number
          const parsedNumber = phoneUtil.parse(number);

          // Check validity
          if (!phoneUtil.isValidNumber(parsedNumber)) {
            return helpers.message('Invalid phone number ');
          }
        } catch (err) {
          return helpers.message('Invalid phone number ');
        }
      }

      // Duplicate check (after trimming)
      let uniqueNumbers = new Set(numbers);
      if (uniqueNumbers.size !== numbers.length) {
        return helpers.message('Duplicate phone numbers are not allowed');
      }

      uniqueNumbers = [...new Set(numbers)];

      return uniqueNumbers;
    })
    .messages({
      'string.base': 'Destination must be a string',
      'any.required': 'Destination is required for WhatsApp service',
    }),

  attachments: Joi.when('service', {
    is: 'whatsapp',
    then: Joi.array()
      .optional()
      .custom((value, helpers) => {
        return validateWhatsAppAttachements(value, helpers);
      }),

    otherwise: Joi.forbidden(),
  }),

  templateId: Joi.string().optional().pattern(whatsappTemplateRegex).messages({
    'string.base': 'Template ID must be a string',
    'string.empty': 'Template ID cannot be empty',
    'string.pattern.base':
      'Invalid WhatsApp template ID format. It must start with HX followed by 32 hex characters',
    'any.required': 'Template ID is required',
  }),

  fromNumber: Joi.string()
    .optional()
    .custom((value, helpers) => {
      const parsedNumber = phoneUtil.parse(value);
      if (
        !phonenNumberRegex.test(value) ||
        !phoneUtil.isValidNumber(parsedNumber)
      ) {
        return helpers.message('Invalid phone number ');
      }
      return value;
    }),

  message: Joi.string().trim().optional().messages({
    'string.base': 'Message must be a string',
    'string.empty': 'Message cannot be empty',
  }),

  contentVariables: Joi.object().optional().messages({
    'object.base': 'contentVariables must be an object',
  }),
};

module.exports = whatsAppValidation;
