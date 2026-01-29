const Joi = require("joi");

const validateSlackList = (value, helpers, fieldName) => {
  const channels = value.split(",").map((e) => e.trim());

  const unique = new Set(channels);
  if (unique.size !== channels.length) {
    return helpers.message(
      `Duplicate Channel IDs are not allowed in ${fieldName}.`,
    );
  }

  for (const channel of channels) {
    if (!channel) {
      return helpers.message(`Empty Channel ID found in ${fieldName}.`);
      return;
    }

    if (!/^[A-Za-z0-9_-]+$/.test(channel)) {
      return helpers.message(
        `Channel ID "${channel}" in ${fieldName} is invalid. Only letters, numbers, underscores, and hyphens are allowed and for multiple channels  use comma separate`,
      );
    }

    if (channel.length < 1) {
      return helpers.message(
        `Channel ID "${channel}" in ${fieldName} is too short. Minimum length is 1 character`,
      );
    }
    if (channel.length > 50) {
      return helpers.message(
        `Channel ID "${channel}" in ${fieldName} is too long. Maximum length is 50 characters`,
      );
    }
  }

  return value;
};

const slackValidation = {
  destination: Joi.string()
    .required()
    .custom((value, helpers) =>
      validateSlackList(value, helpers, "destination"),
    )
    .messages({
      "string.empty": "Destination Channel ID is required for Slack service.",
      "any.required": "Destination Channel ID is required for Slack service.",
    }),
};

module.exports = slackValidation;
