const Joi = require("joi");
const { commonValidation } = require("../validators/common.validator");
const cleanJoiMessage = require("../../helpers/cleanJoiMessage");

const registerTemplateSchema = Joi.object({
  service: Joi.string()
    .trim()
    .valid("slack", "sms", "email", "whatsapp")
    .required(),

  templateId: Joi.string()
    .trim()
    .pattern(/^[A-Za-z0-9_-]+$/)
    .min(3)
    .max(50)
    .when("service", {
      is: Joi.valid("sms", "whatsapp"),
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .messages({
      "string.pattern.base":
        "templateId can contain only letters, numbers, _ and - without spaces",
      "string.empty": "templateId cannot be empty",
      "any.required": "templateId is required for sms and whatsapp",
    }),

  name: Joi.string().trim().min(3).max(20).required().messages({
    "string.base": "Name must be a string",
    "string.empty": "Name cannot be empty",
    "string.min": "Name must be at least 3 characters long",
    "string.max": "Name cannot exceed 20 characters",
    "any.required": "Name is required",
  }),

  messageContent: Joi.string()
    .trim()
    .required()
    .when("service", {
      is: Joi.valid("slack", "sms", "whatsapp"),
      then: Joi.string().custom((value, helpers) => {
        if (/<[^>]+>/.test(value)) {
          return helpers.message("HTML tags are not allowed for this service");
        }
        return value;
      }),
    }),

  variables: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        constraints: Joi.object({
          maxlength: Joi.number().integer().min(1).optional().messages({
            "number.base": "maxlength must be an integer",
            "number.integer": "maxlength must be an integer",
            "number.min": "maxlength must be greater than 0",
          }),
          dataType: Joi.string()
            .valid("string", "integer", "number")
            .optional()
            .messages({
              "any.only": "dataType must be one of [string, integer, number]",
              "string.base": "dataType must be a string",
            }),
        }).optional(),
      }),
    )
    .optional(),
});

const queryTemplateSchema = Joi.object({
  service: Joi.string()
    .trim()
    .valid("email", "slack", "sms", "whatsapp")
    .messages({
      "string.base": "Service must be a string",
      "any.only": "Service value is not acceptable",
    }),
  name: Joi.string().trim().max(20).messages({
    "string.base": "Name must be a string",
    "string.max": "Name cannot exceed 20 characters",
  }),
  templateId: Joi.string().trim().max(50).messages({
    "string.base": "templateId must be a string",
    "string.max": "templateId cannot exceed 50 characters",
  }),
  page: commonValidation.page,
  limit: commonValidation.limit,
});

const validateRegisterTemplateBody = (req, res, next) => {
  try {
    if (!req.body) {
      throw {
        statusCode: 422,
        message: "Invalid Content-Type or Request Body",
      };
    }

    const { error, value } = registerTemplateSchema.validate(req.body);

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

const validateQueryTemplateRequest = (req, res, next) => {
  try {
    const { error, value } = queryTemplateSchema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });
    console.log(error);
    if (error) {
      return res.status(400).json({
        success: false,
        message: cleanJoiMessage(error.details[0].message),
      });
    }

    req.query = value;
    next();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: cleanJoiMessage(error.message) || "Internal server error",
    });
  }
};

const paramIdSchema = Joi.object({
  id: Joi.number()
    .custom((value, helpers) => {
      const raw = helpers.original;
      if (typeof raw === "string" && !/^[0-9]+$/.test(raw)) {
        return helpers.error("number.integer");
      }
      return value;
    })
    .integer()
    .min(1)
    .messages({
      "number.base": "id must be a number",
      "number.integer": "id must be a positive integer",
      "number.min": "id must be a positive integer",
      "number.unsafe": "id must be a valid integer",
    }),
});

const validateParamId = (req, res, next) => {
  try {
    const { error, value } = paramIdSchema.validate(req.params, {
      stripUnknown: true,
    });
    console.log(error);
    if (error) {
      return res.status(400).json({
        success: false,
        message: cleanJoiMessage(error.details[0].message),
      });
    }

    req.params = value;
    next();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        cleanJoiMessage(error.details[0].message) || "Internal server error",
    });
  }
};

module.exports = {
  validateRegisterTemplateBody,
  validateQueryTemplateRequest,
  validateParamId,
};
