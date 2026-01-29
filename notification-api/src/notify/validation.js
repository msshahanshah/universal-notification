const Joi = require("joi");
const {
  baseOptions,
  commonValidation,
} = require("../validators/common.validator");
const emailValidation = require("../validators/email.validator");
const slackValidation = require("../validators/slack.validator");
const smsValidation = require("../validators/sms.validator");
require("dotenv").config({
  path: require("path").resolve(__dirname, "../../../.env"),
}); // Define the validation schema

console.log(
  "Environment Variables:",
  require("path").resolve(__dirname, "../../../.env"),
);
const destination = Joi.alternatives()
  .conditional("service", {
    switch: [
      { is: "slack", then: slackValidation.destination.required() },
      { is: "email", then: emailValidation.destination.required() },
      { is: "sms", then: smsValidation.destination.required() },
    ],
    otherwise: Joi.forbidden().messages({
      "any.unknown": "Invalid service type",
    }),
  })
  .required()
  .messages({ "string.empty": "Destination is required" });
const extension_mimetype_map = {
  "application/pdf": "pdf",
  "image/x-png": "png",
  "image/x-citrix-jpeg": "jpeg",
};
const validateSchema = Joi.object({
  service: commonValidation.service,
  destination,
  message: commonValidation.message,
  subject: emailValidation.subject,
  body: emailValidation.body,
  fromEmail: emailValidation.fromEmail,
  cc: emailValidation.cc,
  bcc: emailValidation.bcc,
  attachments: emailValidation.attachments,
  mimetype: emailValidation.mimetype,
}).unknown(false); // Middleware to validate the request

const validateRequest = (req, res, next) => {
  const { error, value } = validateSchema.validate(req.body, baseOptions);
  if (error) {
    return res
      .status(400)
      .json({ success: false, message: error.details[0].message });
  }
  if (req.body.service == "email" && req.body.attachments === true) {
    req.body.extension = extension_mimetype_map[value.mimetype];
  }
  req.body = value;

  next();
};
module.exports = validateRequest;
