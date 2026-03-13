const Joi = require("joi");
const { commonValidation } = require("../validators/common.validator");

const registerTemplateSchema = Joi.object({
    service: Joi.string()
        .valid("slack", "sms", "email", "whatsapp")
        .required(),

    templateId: Joi.string().when("service", {
        is: Joi.valid("sms", "whatsapp"),
        then: Joi.required(),
        otherwise: Joi.optional(),
    }),

    name: Joi.string()
        .min(3)
        .max(20)
        .required()
        .messages({
            "string.base": "Name must be a string",
            "string.empty": "Name cannot be empty",
            "string.min": "Name must be at least 3 characters long",
            "string.max": "Name cannot exceed 20 characters",
            "any.required": "Name is required"
        }),

    messageContent: Joi.string().required().when("service", {
        is: Joi.valid("slack", "sms", "whatsapp"),
        then: Joi.string().custom((value, helpers) => {
            if (/<[^>]+>/.test(value)) {
                return helpers.message("HTML tags are not allowed for this service");
            }
            return value;
        }),
    }),

    variables: Joi.array().items(
        Joi.object({    
            name: Joi.string().required(),
            constraints: Joi.object({
                maxlength: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
                dataType: Joi.string().optional(),
                required: Joi.boolean().optional(),
            }).optional(),
        })
    ).optional(),
});

const queryTemplateSchema = Joi.object({
    service: Joi.string()
        .trim()
        .valid("email", "slack", "sms", "whatsapp")
        .messages({
            "string.base": "Service must be a string",
            "any.only": "Service value is not acceptable",
        }),
    name: Joi.string()
        .trim()
        .max(20)
        .messages({
            "string.base": "Name must be a string",
            "string.max": "Name cannot exceed 20 characters"
        }),
    templateId: Joi.string()
        .trim()
        .max(50)
        .messages({
            "string.base": "templateId must be a string",
            "string.max": "templateId cannot exceed 50 characters"
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
                message: error.details[0].message,
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

const validateQueryTemplateRequest = (req, res, next) => {
    try {
        const { error, value } = queryTemplateSchema.validate(req.query, { abortEarly: false, stripUnknown: true });

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
            message: error.message || "Internal server error",
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
            "number.integer": "id must be an integer",
            "number.min": "id must be a positive integer",
            "number.unsafe": "id must be a valid integer",
        }),
});

const validateParamId = (req, res, next) => {
    try {
        const { error, value } = paramIdSchema.validate(req.params, { stripUnknown: true });

        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message,
            });
        }

        req.params = value;
        next();
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Internal server error",
        });
    }
};

module.exports = {
    validateRegisterTemplateBody,
    validateQueryTemplateRequest,
    validateParamId
};