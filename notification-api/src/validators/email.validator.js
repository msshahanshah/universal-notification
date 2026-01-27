const Joi = require("joi");

const emailRegex =
  /^(?=.{6,254}$)[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+\.(com|in|org)$/;

const validateEmailList = (value, helpers, fieldName) => {
  const emails = value.split(",").map((e) => e.trim());

  if (fieldName === "fromEmail" && emails.length > 1) {
    return helpers.message(`In fromEmail field there can be only one email.`);
  }
  const unique = new Set(emails);
  if (unique.size !== emails.length) {
    return helpers.message(
      `There are duplicate emails in ${fieldName}. Each email must be unique.`,
    );
  }

  for (const email of emails) {
    if (!email) {
      return helpers.message(
        `One of the emails in ${fieldName} is empty. Please provide a valid email and for multiple emails use comma separate`,
      );
    }

    if (email.length < 6) {
      return helpers.message(
        `Email "${email}" in ${fieldName} is too short. Minimum length is 6 characters.`,
      );
    }

    if (email.length > 254) {
      return helpers.message(
        `Email "${email}" in ${fieldName} is too long. Maximum length is 254 characters.`,
      );
    }

    if (!emailRegex.test(email)) {
      return helpers.message(`Email "${email}" in ${fieldName} is invalid.`);
    }
  }

  return value;
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
    then: Joi.string().trim().min(1).required().messages({
      "string.empty": "Body is required for email service.",
    }),
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
};

module.exports = emailValidation;
