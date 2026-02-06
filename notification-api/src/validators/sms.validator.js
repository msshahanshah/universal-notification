const Joi = require("joi");
const { PhoneNumberUtil } = require("google-libphonenumber");
const phoneUtil = PhoneNumberUtil.getInstance();

const smsValidation = {
  destination: Joi.string()
    .required()
    .custom((value, helpers) => {
      // Split by comma
      let numbers = value.split(",");

      // Trim & remove empty values
      numbers = numbers.map((n) => n.trim()).filter((n) => n.length > 0);

      // If after cleanup nothing remains
      if (numbers.length === 0) {
        return helpers.message("At least one phone number is required");
      }

      // Single phone number regex
      const phoneRegex = /^\+[0-9]+$/;

      // Validate each number
      for (const number of numbers) {
        if (!phoneRegex.test(number)) {
          return helpers.message("Invalid phone number ");
        }

        try {
          // Parse number
          const parsedNumber = phoneUtil.parse(number);

          // Check validity
          if (!phoneUtil.isValidNumber(parsedNumber)) {
            return helpers.message("Invalid phone number ");
          }
        } catch (err) {
          return helpers.message("Invalid phone number ");
        }
      }

      // Duplicate check (after trimming)
      let uniqueNumbers = new Set(numbers);
      if (uniqueNumbers.size !== numbers.length) {
        return helpers.message("Duplicate phone numbers are not allowed");
      }

      uniqueNumbers = [...new Set(numbers)];

      return uniqueNumbers.join(",");
    })
    .messages({
      "string.base": "Destination must be a string",
      "any.required": "Destination is required for SMS service",
    }),
};

module.exports = smsValidation;
