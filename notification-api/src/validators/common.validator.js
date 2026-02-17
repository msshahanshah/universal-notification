const Joi = require("joi");
const baseOptions = { abortEarly: false, stripUnknown: false };
const { fileNameRegex, urlRegex } = require("../../helpers/regex.helper");

//----------------common validation ----------------------

const commonValidation = {
  page: Joi.number().integer().min(1).optional().messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),
  limit: Joi.number().integer().min(1).max(100).optional().messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),
  service: Joi.string().required().valid("email", "slack", "sms").messages({
    "string.base": "Service must be a string",
    "any.only": "Service must be one of: email, slack, sms",
    "string.empty": "Service cannot be empty",
  }),
  message: Joi.string()
    .trim()
    .when("service", {
      is: "email",
      then: Joi.forbidden().messages({
        "any.unknown": "Message is not allowed for email service",
      }),
      otherwise: Joi.required().messages({
        "string.base": "Message must be a string",
        "string.empty": "Message cannot be empty",
        "any.required": "Message is required for this service",
      }),
    }),
};


//---------email attachments validation----------

//taking map for increasing count for duplicate filenames
let map = new Map();

function changeDuplicateFileName(fileName) {
  if (map.has(fileName)) {
    let cnt = map.get(fileName);

    let idx = fileName.lastIndexOf(".");
    if (idx == -1) idx = fileName.length;

    const newFileName =
      fileName.slice(0, idx) + String(cnt) + fileName.slice(idx);

    // increase the cnt for next duplicate filename
    map.set(fileName, cnt + 1);
    return newFileName;
  } else map.set(fileName, 1);

  return fileName;
}

function validateFileName(fileName) {
  if (!fileName?.length) return "FileName cannot be empty";
  if (!fileNameRegex.test(fileName)) return "FileName is not valid";
  return null;
}

function validateUrl(url) {
  if (!url?.length) return "Url cannot be empty";
  if (!urlRegex.test(url)) return "Url is not valid";
  return null;
}

const validateAttachments = (values, helpers) => {
  map = new Map();
  if (values.length) {
    const allowedKeys = ["fileName", "url"]; // only this keys is allowed in attachemnts

    //checking each value for attachments array

    for (let idx = 0; idx < values.length; idx++) {
      const item = values[idx];

      switch (typeof item) {
        case "string": {
          const clearedFileName = item.trim();
          const isMessage = validateFileName(clearedFileName);

          if (isMessage) {
            return helpers.message(isMessage);
          }

          //changin the name of duplicate files
          values[idx] = changeDuplicateFileName(clearedFileName);
          break;
        }
        case "object": {
          const keys = Object.keys(item);

          if (
            !(keys.length === allowedKeys.length) ||
            !("fileName" in item) ||
            !("url" in item)
          ) {
            return helpers.message(
              "In attachments array object is invalid it must contain only fileName and url",
            );
          }
          const { fileName, url } = item;

          //check fileName and validate

          let clearedFileName = fileName.trim();
          let isMessage = validateFileName(clearedFileName);
          if (isMessage) {
            return helpers.message(isMessage);
          }

          //check url and validate

          isMessage = validateUrl(url);
          if (isMessage) {
            return helpers.message(isMessage);
          }

          //changin the name of duplicate files
          values[idx].fileName = changeDuplicateFileName(clearedFileName);
          break;
        }
        default: {
          return helpers.message(
            "Expected string of filenames or object with fileName and url",
          );
        }
      }
    }
  } else {
    return helpers.message("Attachements can not be empty array");
  }

  return values;
};

module.exports = { commonValidation, baseOptions, validateAttachments };
