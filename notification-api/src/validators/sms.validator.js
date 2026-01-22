const Joi = require("joi");
const smsValidation = {
  destination: Joi.string().custom((value, helpers) => {
    const regex = /^(\+[1-9]\d{1,14})(,\+[1-9]\d{1,14})*$/;

    if (!regex.test(value)) {
      return helpers.message(
        "Destination must be a single valid mobile number or comma-separated numbers (e.g., +1234567890) for SMS service",
      );
    }

    return value;
  }),
};

module.exports = smsValidation;
