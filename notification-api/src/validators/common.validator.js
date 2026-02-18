const Joi = require("joi");
const baseOptions = { abortEarly: false, stripUnknown: false };
const { fileNameRegex, urlRegex } = require("../../helpers/regex.helper");

// --------------------COMMON  VALIDATION----------------------------
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

// --------------------ATTACHMENTS VALIDATION----------------------------

//taking map for increasing count for duplicate filenames

function changeDuplicateFileName(fileName, map) {
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
  const map = new Map();

  if (values.length) {
    if (values.length > 10)
      return helpers.message(
        "Attachments array can not have more then 10 length",
      );
    //checking for array of filenames
    if (typeof values[0] === "string") {
      for (let idx = 0; idx < values.length; idx++) {
        const item = values[idx];

        if (typeof item === "string") {
          const clearedFileName = item.trim();
          const message = validateFileName(clearedFileName);
          if (message) return helpers.message(message);

          //changin the name of duplicate files
          values[idx] = changeDuplicateFileName(clearedFileName, map);
        } else {
          return helpers.message("Attachments must be array of filenames");
        }
      }
    } else if (typeof values[0] === "object") {
      const allowedKeys = ["fileName", "url"]; // only this keys is allowed in attachemnts
      for (let idx = 0; idx < values.length; idx++) {
        const item = values[idx];

        if (typeof item == "object") {
          const keys = Object.keys(item);

          if (
            !(keys.length === allowedKeys.length) ||
            !("fileName" in item) ||
            !("url" in item)
          ) {
            return helpers.message(
              "Attachments must contain only fileName and url",
            );
          }
          const { fileName, url } = item;

          //check fileName and validate

          let clearedFileName = fileName.trim();
          let message = validateFileName(clearedFileName);
          if (message) {
            return helpers.message(message);
          }

          //check url and validate

          message = validateUrl(url);
          if (message) {
            return helpers.message(message);
          }

          //changin the name of duplicate files
          values[idx].fileName = changeDuplicateFileName(clearedFileName, map);
        } else {
          return helpers.message(
            "Attachments must be array of objects with (fileName and url) fields",
          );
        }
      }
    } else {
      return helpers.message(
        "Attachments must be array of filenames or array of objects with (fileName and url) fields",
      );
    }
  }

  return values;
};

module.exports = { commonValidation, baseOptions, validateAttachments };
