const Joi = require("joi");
const slackValidation = {
  destination: Joi.string().custom((value, helpers) => {
    const regex = /^(\w+)(,\w+)*$/;
    if (!regex.test(value)) {
      return helpers.message(
        "Destination must be a single Channel ID or comma-separated Channel IDs for Slack service",
      );
    }
    return value;
  }),
};

module.exports = slackValidation;
