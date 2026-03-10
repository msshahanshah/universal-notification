const Joi = require('joi');
const {
  baseOptions,
  commonValidation,
} = require('../validators/common.validator');
const emailValidation = require('../validators/email.validator');
const slackValidation = require('../validators/slack.validator');
const smsValidation = require('../validators/sms.validator');
const whatsAppValidation = require('../validators/whatsapp.validator');
require('dotenv').config({
  path: require('path').resolve(__dirname, '../../../.env'),
}); // Define the validation schema

console.log(
  'Environment Variables:',
  require('path').resolve(__dirname, '../../../.env'),
);
const destination = Joi.alternatives()
  .conditional('service', {
    switch: [
      { is: 'slack', then: slackValidation.destination.required() },
      { is: 'email', then: emailValidation.destination.required() },
      { is: 'sms', then: smsValidation.destination.required() },
      { is: 'whatsapp', then: whatsAppValidation.destination.required() },
    ],
    otherwise: Joi.forbidden().messages({
      'any.unknown': 'Invalid service type',
    }),
  })
  .required()
  .messages({ 'string.empty': 'Destination is required' });

const attachments = Joi.alternatives().conditional('service', {
  switch: [
    { is: 'email', then: emailValidation.attachments },
    { is: 'whatsapp', then: whatsAppValidation.attachments },
  ],
  otherwise: Joi.forbidden(),
});

const message = Joi.alternatives().conditional('service', {
  switch: [{ is: 'whatsapp', then: whatsAppValidation.message }],
  otherwise: commonValidation.message,
});

const validateSchema = Joi.object({
  service: commonValidation.service,
  destination,
  message: message,
  subject: emailValidation.subject,
  body: emailValidation.body,
  fromEmail: emailValidation.fromEmail,
  cc: emailValidation.cc,
  bcc: emailValidation.bcc,
  attachments: attachments,
  templateId: whatsAppValidation.templateId,
  contentVariables: whatsAppValidation.contentVariables,
  fromNumber: whatsAppValidation.fromNumber,
})
  .when(Joi.object({ service: Joi.valid('whatsapp') }).unknown(), {
    then: Joi.object()
      .xor('message', 'templateId')
      .with('templateId', 'contentVariables')
      .messages({
        'object.missing':
          "For WhatsApp service either 'message' OR ('templateId' and 'contentVariables') must be provided",
        'object.xor':
          "For WhatsApp service either 'message' OR ('templateId' and 'contentVariables') must be provided",
        'object.with':
          "'contentVariables' must be provided when 'templateId' is used",
      }),
  })
  .unknown(false); // Middleware to validate the request

const validateRequest = (req, res, next) => {
  const { error, value } = validateSchema.validate(req.body, baseOptions);
  if (error) {
    return res
      .status(400)
      .json({ success: false, message: error.details[0].message });
  }
  req.body = value;
  next();
};
module.exports = validateRequest;
