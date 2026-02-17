const Joi = require("joi");
const { validateAttachments } = require("./common.validator");

const validateEmailList = (value, helpers, fieldName) => {
  const isValueEmpty = !value || value.trim().length === 0;
  const mandatoryFields = ["fromEmail", "destination"];

  if (isValueEmpty && fieldName !== "cc" && fieldName != "bcc") {
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

  const emailSchema = Joi.string().email({ tlds: { allow: false } });
  for (const email of emails) {
    const { error } = emailSchema.validate(email);
    if (error) {
      return helpers.message(`Email "${email}" in ${fieldName} is invalid.`);
    }
  }

  return [uniqueEmails.join(", ")];
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
      .optional()
      .allow("")
      .custom((value, helpers) =>
        validateEmailList(value, helpers, "fromEmail"),
      ),
    otherwise: Joi.forbidden(),
  }),
  cc: Joi.when("service", {
    is: "email",
    then: Joi.string()
      .allow("")
      .custom((value, helpers) => validateEmailList(value, helpers, "cc"))
      .optional(),
    otherwise: Joi.forbidden(),
  }),
  bcc: Joi.when("service", {
    is: "email",
    then: Joi.string()
      .allow("")
      .custom((value, helpers) => validateEmailList(value, helpers, "bcc"))
      .optional(),
    otherwise: Joi.forbidden(),
  }),
  attachments: Joi.when("service", {
    is: "email",
    then: Joi.array()
      .optional()
      .custom((value, helpers) => {
        return validateAttachments(value, helpers);
      }),

    otherwise: Joi.forbidden(),
  }),
};
module.exports = emailValidation;
