const Joi = require("joi");
const baseOptions = { abortEarly: false, stripUnknown: false };
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

const validateAttachments = (value, helpers) => {
  if (value.length) {
    const fileNameRegex = new RegExp(/^(?![ .])(?!.*[ .]$)[A-Za-z0-9._ -]+$/);
    const urlRegex = new RegExp(
      "^https?:\\/\\/(?:[a-z0-9.-]+\\.)?s3(?:[.-][a-z0-9-]+)?\\.amazonaws\\.com(?:\\/[\\S]*?)?\\?.*(?:X-Amz-Signature=|X-Amz-Credential=|AWSAccessKeyId=)",
      "i",
    );
    // array of filename
    if (typeof value[0] === "string") {
      // change filename of duplicates filename
      const map = new Map(); //key value pair of (filename -> count)

      for (let i = 0; i < value.length; i++) {
        let filename = value[i];
        if (map.has(filename)) {
          // update filename
          let cnt = map.get(filename);

          let idx = filename.lastIndexOf(".");
          if (idx == -1) idx = filename.length;

          value[i] = filename.slice(0, idx) + String(cnt) + filename.slice(idx);

          // increase the cnt
          map.set(filename, cnt + 1);
        } else map.set(filename, 1);
      }

      for (const filename of value) {
        if (typeof filename !== "string" || !fileNameRegex.test(filename)) {
          return helpers.message(`invalid filename ${filename}`);
        }
      }
    } else if (typeof value[0] === "object") {
      // change file name of duplicates filenames
      const map = new Map(); //key value pair of (filename -> count)

      for (let i = 0; i < value.length; i++) {
        if (Object.keys(value[i]).length == 0) continue;

        let filename = value[i].fileName;
        if (map.has(filename)) {
          // it means we have duplicate filename
          // update filename
          let cnt = map.get(filename);

          let idx = filename.lastIndexOf(".");
          if (idx == -1) idx = filename.length;

          value[i].fileName =
            filename.slice(0, idx) + String(cnt) + filename.slice(idx);

          // increase the cnt
          map.set(filename, cnt + 1);
        } else map.set(filename, 1);
      }

      for (const file of value) {
        if (typeof file !== "object" || file === null) {
          return helpers.message(`invalid email attachments format`);
        }

        if (!file.fileName || !file.url) {
          return helpers.message(
            `missing fields. please provide fileName and url`,
          );
        }

        if (
          typeof file.fileName !== "string" ||
          !fileNameRegex.test(file.fileName)
        ) {
          return helpers.message(`invalid fileName ${file.fileName}`);
        }

        if (typeof file.url !== "string" || !urlRegex.test(file.url)) {
          return helpers.message(
            `invalid s3 presigned url for file ${file.fileName}`,
          );
        }
      }
    }
  }
  return value;
};

module.exports = { commonValidation, baseOptions, validateAttachments };
