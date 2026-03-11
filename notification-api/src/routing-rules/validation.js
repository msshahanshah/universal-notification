const Joi = require("joi");
const { default: parsePhoneNumberFromString } = require("libphonenumber-js");

const emailRegex = /^[^\s@]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const schema = Joi.object({
    service: Joi.string()
        .trim()
        .required()
        .valid("email", "slack", "sms", "whatsapp")
        .messages({
            "string.base": "Service must be a string",
            "string.empty": "Service cannot be empty",
            "any.required": "Service cannot be empty",
            "any.only": "Service value is not acceptable",
        }),

    provider: Joi.string()
        .trim()
        .required()
        .messages({
            "string.empty": "Provider cannot be empty",
            "any.required": "Provider is required",
        }),

    matchKey: Joi.string()
        .trim()
        .required()
        .messages({
            "string.empty": "matchKey cannot be empty",
            "any.required": "matchKey is required",
        }),

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
                                `+${normalizedCode}123456789`
                            );

                            if (!phone || phone.countryCallingCode !== normalizedCode) {
                                return helpers.error("any.invalid");
                            }

                            return normalizedCode;
                        } catch (err) {
                            return helpers.error("any.invalid");
                        }
                    })
                    .messages({
                        "any.invalid":
                            "matchValue must be a valid country calling code",
                        "string.empty": "matchValue cannot be empty",
                        "any.required": "matchValue is required",
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
                    })
                    .messages({
                        "any.invalid":
                            "matchValue must be a valid email or domain",
                        "string.empty": "matchValue cannot be empty",
                        "any.required": "matchValue is required",
                    }),
            },
        ],
        otherwise: Joi.string()
            .trim()
            .required()
            .messages({
                "string.empty": "matchValue cannot be empty",
                "any.required": "matchValue is required",
            }),
    }),
});

const validateRequest = (req, res, next) => {
    try {
        if (!req.body) {
            throw {
                statusCode: 422,
                message: "Invalid Content-Type or Request Body",
            };
        }

        const { error, value } = schema.validate(req.body);

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

module.exports = validateRequest;