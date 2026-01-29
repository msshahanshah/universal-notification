const Joi = require("joi");
const emailRegex = /^(?=.{6,254}$)[a-z0-9._%+-]+@[a-z0-9-]+\.[a-z]{2,}$/i;
const ALLOWED_MIMETYPES = [
  "application/pdf",
  "image/x-png",
  "image/x-citrix-jpeg",
];

const validateEmailList = (value, helpers, fieldName) => {
  const isValueEmpty = !value || value.trim().length === 0;
  const mandatoryFields = ["fromEmail", "destination"];

  if (isValueEmpty) {
    return mandatoryFields.includes(fieldName)
      ? helpers.message(`${fieldName} is required and cannot be empty.`)
      : value;
  }

  let emails = value
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);

  if (emails.length === 0) {
    return mandatoryFields.includes(fieldName)
      ? helpers.message(
          `At least one valid email is required for ${fieldName}.`,
        )
      : "";
  }

  if (fieldName === "fromEmail" && emails.length > 1) {
    return helpers.message(
      `The fromEmail field can only contain a single email.`,
    );
  }

  const uniqueEmails = [...new Set(emails)];

  for (const email of uniqueEmails) {
    if (email.length > 254 || !emailRegex.test(email)) {
      return helpers.message(`Email "${email}" in ${fieldName} is invalid.`);
    }
  }

  return uniqueEmails.join(", ");
};

const emailValidation = {
  destination: Joi.when("service", {
    is: "email",
    then: Joi.string()
      .required()
      .custom((value, helpers) =>
        validateEmailList(value, helpers, "destination"),
      )
      .messages({
        "string.empty": "In destination email is required.",
        "any.required": "In destination email is required for email service.",
      }),
    otherwise: Joi.forbidden(),
  }),
  subject: Joi.when("service", {
    is: "email",
    then: Joi.string().trim().min(1).max(255).required().messages({
      "string.empty": "Subject is required for email service.",
      "string.max": "Subject must not exceed 255 characters.",
    }),
    otherwise: Joi.forbidden(),
  }),
  body: Joi.when("service", {
    is: "email",
    then: Joi.string()
      .trim()
      .min(1)
      .required()
      .messages({ "string.empty": "Body is required for email service." }),
    otherwise: Joi.forbidden(),
  }),
  fromEmail: Joi.when("service", {
    is: "email",
    then: Joi.string()
      .required()
      .custom((value, helpers) =>
        validateEmailList(value, helpers, "fromEmail"),
      )
      .messages({
        "string.empty": "In fromEmail email is required.",
        "any.required": "In fromEmail email is required for email service.",
      }),
    otherwise: Joi.forbidden(),
  }),
  cc: Joi.when("service", {
    is: "email",
    then: Joi.string()
      .custom((value, helpers) => validateEmailList(value, helpers, "cc"))
      .optional(),
    otherwise: Joi.forbidden(),
  }),
  bcc: Joi.when("service", {
    is: "email",
    then: Joi.string()
      .custom((value, helpers) => validateEmailList(value, helpers, "bcc"))
      .optional(),
    otherwise: Joi.forbidden(),
  }),
  attachments: Joi.when("service", {
    is: "email",
    then: Joi.boolean().required().messages({
      "any.required": "Attachments flag is required for Email service.",
      "boolean.base": "Attachments must be either true or false.",
    }),
    otherwise: Joi.forbidden().messages({
      "any.unknown": "Attachments is only allowed for Email service.",
    }),
  }),
  mimetype: Joi.when("service", {
    is: "email",
    then: Joi.when("attachments", {
      is: true,
      then: Joi.string()
        .valid(...ALLOWED_MIMETYPES)
        .required()
        .messages({
          "any.required": "Mimetype is required when attachments is true.",
          "any.only":
            "Mimetype must be one of: application/pdf, image/x-png, image/x-citrix-jpeg.",
          "string.base": "Mimetype must be a valid string.",
        }),
      otherwise: Joi.forbidden().messages({
        "any.unknown": "Mimetype is not allowed when attachments is false.",
      }),
    }),
    otherwise: Joi.forbidden().messages({
      "any.unknown": "Mimetype is only allowed for Email service.",
    }),
  }),
};
module.exports = emailValidation;
