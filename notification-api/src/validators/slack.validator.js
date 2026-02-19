const Joi = require("joi");
const { slackChannelIdRegex } = require("../../helpers/regex.helper");

const slackValidation = {
  destination: Joi.string()
    .required()
    .custom((value, helpers) => {
      // Split by comma
      let channels = value.split(",");

      // Trim & remove empty values
      channels = channels.map((c) => c.trim());

      //checking extra commas

      for (let channel of channels) {
        if (channel.length == 0) {
          return helpers.message(
            `In destination empty commas are not allowed `,
          );
        }
      }

      // If after cleanup nothing remains
      if (channels.length === 0) {
        return helpers.message("At least one Slack channel ID is required");
      }

      // converting channel ids into uppercase

      for (let i = 0; i < channels.length; i++) {
        channels[i] = channels[i].toUpperCase();
      }
      // Slack Channel ID regex
      // C = public channel, G = private channel, D = direct message

      // Validate each channel ID
      for (const channel of channels) {
        if (!slackChannelIdRegex.test(channel)) {
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
