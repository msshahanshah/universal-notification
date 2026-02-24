const Joi = require("joi");
const { loadClientConfigs } = require("../../utillity/loadClientConfigs");
const {
  baseOptions,
  commonValidation,
} = require("../../validators/common.validator");
const emailValidation = require("../../validators/email.validator");
const slackValidation = require("../../validators/slack.validator");
const smsValidation = require("../../validators/sms.validator");

const destinationSchema = Joi.alternatives()
  .conditional("service", {
    switch: [
      { is: "slack", then: slackValidation.destination.required() },
      { is: "email", then: emailValidation.destination.required() },
      { is: "sms", then: smsValidation.destination.required() },
    ],
    otherwise: Joi.forbidden().messages({
      "any.unknown": "Invalid service type",
    }),
  })
  .required()
  .messages({ "string.empty": "Destination is required" });

const validateSchema = Joi.array().items(
  Joi.object({
    service: commonValidation.service,
    destination: destinationSchema,
    message: commonValidation.message,
    subject: emailValidation.subject,
    body: emailValidation.body,
    fromEmail: emailValidation.fromEmail,
    cc: emailValidation.cc,
    bcc: emailValidation.bcc,
    attachments: emailValidation.attachments,
    uniqueKey: Joi.string().optional(),
  }).unknown(false),
);

let configs = null;
const validateRequest = async (req, res, next) => {
  try {
    let { commonMessage, ...sanitizeBody } = req.body;
    const clientId = req.headers["x-client-id"];
    const services = Object.keys(sanitizeBody);
    configs = configs ? configs : await loadClientConfigs();

    // Extract Enabling services of client
    const enabledServices = configs?.filter((conf) => conf.ID === clientId)[0]
      ?.ENABLED_SERVERICES;

    if (!enabledServices || !Array.isArray(enabledServices)) {
      throw {
        statusCode: 500,
        message: `invalid or missing ENABLED_SERVERICES in client config for ${clientId}`,
      };
    }

    // check for enabling service
    services.forEach((service) => {
      if (!enabledServices.includes(service)) {
        return res.status(403).json({
          success: false,
          message: `${service} is not enabled for client ${clientId}`,
        });
      }
    });

    // Validate the request Body service-wise
    for (let [service, body] of Object.entries(sanitizeBody)) {
      // add service to each message and add common Message if required
      let messageWithFileAttachmentCount = 0;
      const uniqueKeySet = new Set();

      const enrichedBody = body.map((item) => {
        if (!item.message && service !== "email") {
          item.message = commonMessage;
        }

        if (!item.body && service == "email") {
          item.body = commonMessage;
        }

        if (item.attachments && typeof item.attachments[0] === "string") {
          messageWithFileAttachmentCount += 1;
        }

        if (item.uniqueKey) {
          uniqueKeySet.add(item.uniqueKey);
        }
        return { ...item, service };
      });

      const { error, value } = validateSchema.validate(
        enrichedBody,
        baseOptions,
      );

      // checking for uniqueKey for messages with attachments
      if (uniqueKeySet.size !== messageWithFileAttachmentCount) {
        throw {
          statusCode: 400,
          message: `distinct uniqueKey is required to sent message with attachment. Please provide uniqueKey for ${service}`,
        };
      }

      sanitizeBody[service] = value;
      if (error) {
        console.log(error);
        return res.status(400).json({
          success: false,
          message: error.details[0].message,
        });
      }
    }

    // update messages in body
    req.body = sanitizeBody;
    next();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "internal server error",
    });
  }
};

module.exports = {
  validateRequest,
};
