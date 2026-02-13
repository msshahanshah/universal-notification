const Joi = require("joi");
const {
  baseOptions,
  commonValidation,
} = require("../validators/common.validator");

const validateSchema = Joi.object({
  service: commonValidation.service,
  provider: Joi.string()
    .required()
    .trim() // remove spaces at start/end
    .pattern(/[A-Za-z]/, "letters only") // must contain at least one letter
    .messages({
      "string.empty": "Provider cannot be empty",
      "string.pattern.name":
        "Provider must contain at least one letter and not just numbers",
      "any.required": "Provider is required",
    }),
}).unknown(false); // Middleware to validate the request

const validateRequest = (req, res, next) => {
  const { error, value } = validateSchema.validate(req.query, baseOptions);
  if (error) {
    return res
      .status(400)
      .json({ success: false, message: error.details[0].message });
  }
  req.body = value;
  next();
};
module.exports = validateRequest;
