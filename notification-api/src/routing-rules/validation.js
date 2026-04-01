const Joi = require("joi");
const { default: parsePhoneNumberFromString } = require("libphonenumber-js");
const { commonValidation } = require("../validators/common.validator");
const {
  SERVICE_PROVIDERS,
  SERVICE_MATCH_KEYS,
  SERVICES,
} = require("../../constants");
const cleanJoiMessage = require("../../helpers/cleanJoiMessage");
const { TagResource$ } = require("@aws-sdk/client-secrets-manager");

const emailRegex = /^[^\s@]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const slackChannelIdRegex = /^[CGD][A-Z0-9]{8,10}$/;

const createSchema = Joi.object({
  service: Joi.string()
    .trim()
    .required()
    .valid(...Object.values(SERVICES))
    .messages({
      "string.base": "Service must be a string",
      "string.empty": "Service cannot be empty",
      "any.required": "Service is required",
      "any.only": "Service value is not acceptable",
    }),

  provider: Joi.when("service", {
    switch: [
      {
        is: "sms",
        then: Joi.string()
          .valid(...SERVICE_PROVIDERS.SMS)
          .required(),
      },
      {
        is: "email",
        then: Joi.string()
          .valid(...SERVICE_PROVIDERS.EMAIL)
          .required(),
      },
      {
        is: "slack",
        then: Joi.string()
          .valid(...SERVICE_PROVIDERS.SLACK)
          .required(),
      },
      {
        is: "whatsapp",
        then: Joi.string()
          .valid(...SERVICE_PROVIDERS.WHATSAPP)
          .required(),
      },
    ],
  }).required(),

  matchKey: Joi.when("service", {
    switch: [
      {
        is: "sms",
        then: Joi.string()
          .valid(...SERVICE_MATCH_KEYS.SMS)
          .required(),
      },
      {
        is: "email",
        then: Joi.string()
          .valid(...SERVICE_MATCH_KEYS.EMAIL)
          .required(),
      },
      {
        is: "slack",
        then: Joi.string()
          .valid(...SERVICE_MATCH_KEYS.SLACK)
          .required(),
      },
      {
        is: "whatsapp",
        then: Joi.string()
          .valid(...SERVICE_MATCH_KEYS.WHATSAPP)
          .required(),
      },
    ],
  }).required(),

  matchValue: Joi.when("service", {
    switch: [
      {
        is: Joi.valid("sms", "whatsapp"),
        then: Joi.string()
          .trim()
          .required()
          .custom((value, helpers) => {
            try {
              const normalizedCode = value.replace("+", "");

              const phone = parsePhoneNumberFromString(
                `+${normalizedCode}123456789`,
              );

              if (!phone || phone.countryCallingCode !== normalizedCode) {
                return helpers.error("any.invalid");
              }

              return normalizedCode;
            } catch (err) {
              return helpers.error("any.invalid");
            }
          }),
      },
      {
        is: "email",
        then: Joi.string()
          .trim()
          .required()
          .custom((value, helpers) => {
            if (emailRegex.test(value) || domainRegex.test(value)) {
              return value;
            }
            return helpers.error("any.invalid");
          }),
      },
      {
        is: "slack",
        then: Joi.string()
          .trim()
          .required()
          .pattern(slackChannelIdRegex),
      },
    ],
    otherwise: Joi.string().trim().required(),
  }).required(),
});

const querySchema = Joi.object({
  service: Joi.string()
    .valid("email", "slack", "sms", "whatsapp")
    .messages({
      "string.base": "Service must be a string",
      "any.only": "Service value is not acceptable",
    }),
  provider: Joi.string().trim().messages({
    "string.base": "Provider must be a string",
  }),
  matchKey: Joi.string().trim().messages({
    "string.base": "matchKey must be a string",
  }),
  matchValue: Joi.string().trim().messages({
    "string.base": "matchValue must be a string",
  }),
  page: commonValidation.page,
  limit: commonValidation.limit,
}).unknown(false);

const validateCreateRequest = (req, res, next) => {
  try {
    if (!req.body) {
      throw {
        statusCode: 422,
        message: "Invalid Content-Type or Request Body",
      };
    }

    const { error, value } = createSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: cleanJoiMessage(error.details[0].message),
      });
    }

    req.body = value;
    next();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

const validateUpdateRequest = (req, res, next) => {
  try {
    if (!req.body) {
      throw {
        statusCode: 422,
        message: "Invalid Content-Type or Request Body",
      };
    }

    const { error, value } = createSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: cleanJoiMessage(error.details[0].message),
      });
    }

    req.body = value;
    next();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: cleanJoiMessage(error.message) || "Internal server error",
    });
  }
};

const validateQueryRequest = (req, res, next) => {
  try {
    const { error, value } = querySchema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    console.log(value);
    if (error) {
      return res.status(400).json({
        success: false,
        message: cleanJoiMessage(error.details[0].message),
      });
    }
    next();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: cleanJoiMessage(error.message) || "Internal server error",
    });
  }
};

module.exports = {
  validateCreateRequest,
  validateUpdateRequest,
  validateQueryRequest,
};
