const Joi = require('joi');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
// Define the validation schema

console.log('Environment Variables:', require('path').resolve(__dirname, '../../../.env'));
const services = process.env.SERVICE.split(',');

const validateSchema = Joi.object({
    service: Joi.string().valid(...services).required(),
    message: Joi.string().when('service', {
        is: 'email',
        then: Joi.forbidden(),
        otherwise: Joi.string().required().messages({
            'string.empty': 'Message is required'
        })
    }),
    subject: Joi.string().when('service', {
        is: 'email',
        then: Joi.string().required().messages({
            'string.empty': 'Subject is required for Email service'
        }),
        otherwise: Joi.forbidden()
    }),
    body: Joi.string().when('service', {
        is: 'email',
        then: Joi.string().required().messages({
            'string.empty': 'Body is required for Email service'
        }),
        otherwise: Joi.forbidden()
    }),
    fromEmail: Joi.string().when('service', {
        is: 'email',
        then: Joi.string().email().required().messages({
            'string.empty': 'From email is required for Email service',
            'string.email': 'From email must be a valid email address'
        }),
        otherwise: Joi.forbidden()
    }),
    destination: Joi.string()
        .custom((value, helpers) => {
            const service = helpers.state.ancestors[0].service;
            // Regex for single or comma-separated values (alphanumeric with optional underscores)
            const baseRegex = /^(\w+)(,\w+)*$/;

            if (service === 'slack') {
                if (!baseRegex.test(value)) {
                    return helpers.message('Destination must be a single Channel ID or comma-separated list of Channel IDs for Slack service');
                }
            } else if (service === 'email') {
                // Regex for single or multiple emails
                const emailRegex = /^([\w.-]+@[\w.-]+\.\w+)(,[\w.-]+@[\w.-]+\.\w+)*$/;
                if (!emailRegex.test(value)) {
                    return helpers.message('Destination must be a single valid email address or comma-separated list of valid email addresses for Email service');
                }
            } else if (service === 'sms') {
                // Regex for single or multiple phone numbers
                const smsRegex = /^(\+[1-9]\d{1,14})(,\+[1-9]\d{1,14})*$/;
                if (!smsRegex.test(value)) {
                    return helpers.message('Destination must be a single valid mobile number or comma-separated list of valid mobile numbers (e.g., +1234567890) for SMS service');
                }
            }
            return value;
        })
        .required()
        .messages({
            'string.empty': 'Destination is required',
        }),
});

// Middleware to validate the request
const validateRequest = (req, res, next) => {
    const { error } = validateSchema.validate(req.body, { abortEarly: false });
    if (error) {
        return res.status(400).json({ errors: error.details.map(err => err.message) });
    }
    next();
};
module.exports = validateRequest;
