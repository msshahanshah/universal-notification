const Joi = require("joi");

const emailValidation = {
  destination: Joi.string().custom((value, helpers) => {
    const regex = /^([\w.-]+@[\w.-]+\.\w+)(,[\w.-]+@[\w.-]+\.\w+)*$/;
    if (!regex.test(value)) {
      return helpers.message(
        "Destination must be a single valid email or comma-separated emails for Email service",
      );
    }
    return value;
  }),

  subject: Joi.string().when("service", {
    is: "email",
    then: Joi.string().required().messages({
      "string.empty": "Subject is required for Email service",
    }),
    otherwise: Joi.forbidden(),
  }),
  body: Joi.string().when("service", {
    is: "email",
    then: Joi.string().required().messages({
      "string.empty": "Body is required for Email service",
    }),
    otherwise: Joi.forbidden(),
  }),

  fromEmail: Joi.string().when("service", {
    is: "email",
    then: Joi.string().email().required().messages({
      "string.empty": "From email is required for Email service",
      "string.email": "From email must be a valid email address",
    }),
    otherwise: Joi.forbidden(),
  }),

  cc: Joi.when("service", {
    is: "email",
    then: Joi.string().custom((value, helpers) => {
      const emailRegex = /^[\w.-]+@[\w.-]+\.\w+$/;
      const arr = value
        .trim()
        .split(",")
        .map((str) => {
          if (str !== "") {
            return str;
          }
        });
      let result = "";
      for (let i = 0; i < arr.length; i++) {
        if (typeof arr[i] === "string" && arr[i].trim() !== "") {
          const email = arr[i].trim();
          if (emailRegex.test(email)) {
            result += email;
            result += ",";
          }
        }
      }

      if (result.length === 0) {
        return helpers.message("There is no valid email in cc.");
      }

      return result;
    }),
    otherwise: Joi.forbidden(),
  }),
  bcc: Joi.when("service", {
    is: "email",
    then: Joi.string().custom((value, helpers) => {
      const emailRegex = /^[\w.-]+@[\w.-]+\.\w+$/;
      const arr = value
        .trim()
        .split(",")
        .map((str) => {
          if (str !== "") {
            return str;
          }
        });
      let result = "";
      for (let i = 0; i < arr.length; i++) {
        if (typeof arr[i] === "string" && arr[i].trim() !== "") {
          const email = arr[i].trim();
          if (emailRegex.test(email)) {
            result += email;
            result += ",";
          }
        }
      }

      if (result.length === 0) {
        return helpers.message("There is no valid email in bcc.");
      }
      return result;
    }),
    otherwise: Joi.forbidden(),
  }),
};
module.exports = emailValidation;
