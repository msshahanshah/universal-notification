const Joi = require("joi");
const { loadClientConfigs } = require("../../utillity/loadClientConfigs");
const {
  baseOptions,
  commonValidation,
} = require("../../validators/common.validator");
const emailValidation = require("../../validators/email.validator");
const slackValidation = require("../../validators/slack.validator");
const smsValidation = require("../../validators/sms.validator");
const whatsAppValidation = require("../../validators/whatsapp.validator");
const logger = require("../../logger");
const cleanJoiMessage = require("../../../helpers/cleanJoiMessage");
const { SERVICES } = require("../../../constants");

const destinationSchema = Joi.alternatives()
  .conditional("service", {
    switch: [
      { is: "slack", then: slackValidation.destination.required() },
      { is: "email", then: emailValidation.destination.required() },
      { is: "sms", then: smsValidation.destination.required() },
      { is: "whatsapp", then: whatsAppValidation.destination.required() },
    ],
    otherwise: Joi.forbidden().messages({
      "any.unknown": "Invalid service type",
    }),
  })
  .required()
  .messages({ "string.empty": "Destination is required" });

const attachmentValidation = Joi.alternatives().conditional("service", {
  switch: [
    { is: "email", then: emailValidation.attachments },
    { is: "whatsapp", then: whatsAppValidation.attachments },
  ],
  otherwise: Joi.forbidden(),
});

const messageObject = Joi.object({
  service: commonValidation.service,
  destination: destinationSchema,

  message: Joi.when("templateId", {
    is: Joi.exist(),
    then: Joi.forbidden().messages({
      "object.unknown": "message is not allowed when templateId is provided",
      "any.forbidden": "message is not allowed when templateId is provided",
    }),
    otherwise: commonValidation.message,
  }),

  body: Joi.when("templateId", {
    is: Joi.exist(),
    then: Joi.forbidden().messages({
      "any.forbidden": "body is not allowed when templateId is provided",
    }),
    otherwise: emailValidation.body.optional(),
  }),

  subject: emailValidation.subject,

  fromEmail: emailValidation.fromEmail,
  cc: emailValidation.cc,
  bcc: emailValidation.bcc,

  attachments: attachmentValidation,

  uniqueKey: Joi.string().trim().min(1).optional(),

  templateId: Joi.string().trim().optional(),

  variableValues: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
})
  .unknown(false)

  .when(Joi.object({ templateId: Joi.exist() }).unknown(), {
    then: Joi.object({
      message: Joi.forbidden().messages({
        "any.forbidden": "message is not allowed when templateId is provided",
        "any.unknown": "message is not allowed when templateId is provided",
      }),

      body: Joi.forbidden().messages({
        "any.forbidden": "body is not allowed when templateId is provided",
        "any.unknown": "message is not allowed when templateId is provided",
      }),
    }),
  })

  .when(Joi.object({ variableValues: Joi.exist() }).unknown(), {
    then: Joi.object({
      templateId: Joi.required().messages({
        "any.required":
          "templateId is required when variable values is provided",
      }),
    }),
  })
  .when(Joi.object({ service: Joi.valid("email") }).unknown(), {
    then: Joi.object().or("templateId", "body"),
  })

  .when(Joi.object({ service: Joi.valid("whatsapp") }).unknown(), {
    then: Joi.object().or("message", "attachments", "templateId"),
  })

  .when(
    Joi.object({
      service: Joi.valid("sms", "slack"),
    }).unknown(),
    {
      then: Joi.object().or("message", "templateId"),
    },
  );

const validateSchema = Joi.array().min(1).max(5).items(messageObject).messages({
  "array.max": "messages should not exceed 5.",
  "array.min": "At least one message is required.",
});

let configs = null;
const validateRequest = async (req, res, next) => {
  try {
    let { commonMessage, ...sanitizeBody } = req.body;

    const clientId = req.headers["x-client-id"];
    const services = Object.keys(sanitizeBody);

    if (!services.length) {
      throw { statusCode: 400, message: "No notification service specified" };
    }
    configs = configs ? configs : await loadClientConfigs();

    // Extract Enabling services of client
    const enabledServices = configs?.filter((conf) => conf.ID === clientId)[0]
      ?.ENABLED_SERVERICES;

    if (!enabledServices || !Array.isArray(enabledServices)) {
      logger.error(
        `invalid or missing ENABLED_SERVERICES in client config for ${clientId}`,
      );
      throw {
        statusCode: 500,
        message: `invalid or missing ENABLED_SERVERICES in client config for ${clientId}`,
      };
    }

    // check for enabling service
    services.forEach((service) => {
      if (!enabledServices.includes(service)) {
        logger.error(
          `ERROR: ${service} is not enabled for ${clientId}. All enabled services for ${clientId} are ${JSON.stringify(enabledServices)}`,
        );

        throw {
          service,
          statusCode: 400,
          message: SERVICES.service ? `${service} is not enabled` : "Invalid service",
        };
      }
    });

    // Validate the request Body service-wise
    for (let [service, body] of Object.entries(sanitizeBody)) {
      // add service to each message and add common Message if required
      if (!Array.isArray(body)) {
        throw {
          service,
          statusCode: 400,
          message: "messages must be array of objects.",
        };
      }
      let messageWithFileAttachmentCount = 0;
      const uniqueKeySet = new Set();

      const enrichedBody = body.map((item) => {
        if (!item.templateId && !item.message && service !== "email") {
          item.message = commonMessage;
        }

        if (!item.templateId && !item.body && service == "email") {
          item.body = commonMessage;
        }

        if (item.attachments && typeof item.attachments[0] === "string") {
          messageWithFileAttachmentCount += 1;
        }

        if (item.uniqueKey) {
          uniqueKeySet.add(item.uniqueKey.trim());
        }
        return { ...item, service };
      });

      const { error, value } = validateSchema.validate(
        enrichedBody,
        baseOptions,
      );
      // checking for uniqueKey for messages with attachments when there are file attachment
      if (
        messageWithFileAttachmentCount !== 0 &&
        uniqueKeySet.size < messageWithFileAttachmentCount
      ) {
        throw {
          service,
          statusCode: 400,
          message: `distinct uniqueKey is required to sent message with attachment.`,
        };
      }

      if (error) {
        throw {
          service,
          statusCode: 400,
          message: cleanJoiMessage(error.details[0]?.message) || error.message,
        };
      }

      sanitizeBody[service] = value;
      if (error) {
        logger.error("ERROR: validation failed notify: v2", error);
        return res.status(400).json({
          data: {
            [service]: {
              success: false,
              statusCode: 400,
              message: error.details[0].message,
            },
          },
        });
      }
    }

    // update messages in body
    req.body = sanitizeBody;
    next();
  } catch (error) {
    console.log(error);
    if (error.service) {
      return res.status(error.statusCode || 500).json({
        data: {
          [error?.service || "internal"]: {
            success: false,
            statusCode: error.statusCode,
            message: error.message,
          },
        },
      });
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  validateRequest,
};
