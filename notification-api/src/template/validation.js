const Joi = require("joi");

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

    messageContent: Joi.string().required(),

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


module.exports = {
    validateRegisterTemplateBody
};