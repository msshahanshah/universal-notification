const Joi = require("joi");

const ALLOWED_COUNTRY_CODES = [
  "1",
  "7",
  "20",
  "27",
  "30",
  "44",
  "49",
  "61",
  "81",
  "91",
  "92",
  "93",
  "94",
  "95",
  "98",
];

const smsValidation = {
  destination: Joi.string()
    .required()
    .custom((value, helpers) => {
      const numbers = value.split(",");

      // Format regex: +<countryCode><10-digit-number>
      const phoneRegex = /^\+[0-9]{1,3}[0-9]{10}$/;

      const unique = new Set(numbers);
      if (unique.size !== numbers.length) {
        return helpers.message("Duplicate phone numbers are not allowed");
      }

      for (const number of numbers) {
        if (!phoneRegex.test(number)) {
          return helpers.message(
            `Invalid phone number format: ${number}. Use +<countryCode><10-digit-number> and for multiple phone numbers use comma separate`,
          );
        }

        const digits = number.slice(1);

        const countryCode = ALLOWED_COUNTRY_CODES.find((code) =>
          digits.startsWith(code),
        );

        if (!countryCode) {
          return helpers.message(`Invalid country code in number: ${number}`);
        }

        const phoneNumber = digits.slice(countryCode.length);
        if (phoneNumber.length !== 10) {
          return helpers.message(
            `Invalid phone number length for country code +${countryCode}`,
          );
        }
      }

      return value;
    })
    .messages({
      "string.base": "Destination must be a string",
      "any.required": "Destination is required for SMS service",
    }),
};

module.exports = smsValidation;
