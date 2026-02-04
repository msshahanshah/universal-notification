const Joi = require("joi");

const regex = /^[CGD][A-Z0-9]{8,10}$/;

const slackValidation = {
  destination: Joi.string()
    .required()
    .custom((value, helpers) => {
      // Split by comma
      let channels = value.split(",");

      // Trim & remove empty values
      channels = channels.map((c) => c.trim()).filter((c) => c.length > 0);

      // If after cleanup nothing remains
      if (channels.length === 0) {
        return helpers.message("At least one Slack channel ID is required");
      }

      // Slack Channel ID regex
      // C = public channel, G = private channel, D = direct message

      // Validate each channel ID
      for (const channel of channels) {
        if (!regex.test(channel)) {
          return helpers.message(`Invalid Slack channel ID: ${channel}.`);
        }
      }

      // Duplicate check
      const uniqueChannels = new Set(channels);
      if (uniqueChannels.size !== channels.length) {
        return helpers.message("Duplicate Slack channel IDs are not allowed");
      }

      // Return cleaned value
      return [...uniqueChannels];
    })
    .messages({
      "string.base": "Destination must be a string",
      "any.required": "Destination is required for Slack service",
    }),
};

module.exports = slackValidation;
