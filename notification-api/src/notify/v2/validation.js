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
const { validPublicURL } = require("../../../helpers/regex.helper");
const { SERVICES } = require("../../../constants");

const isNonEmpty = (value) =>
  value !== undefined &&
  value !== null &&
  !(typeof value === "string" && value.trim() === "");

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const normalizeEmptyKeys = (item) => {
  const next = { ...item };

  if (hasOwn(next, "message") && !isNonEmpty(next.message)) {
    delete next.message;
  }

  if (hasOwn(next, "body") && !isNonEmpty(next.body)) {
    delete next.body;
  }

  if (hasOwn(next, "templateId") && !isNonEmpty(next.templateId)) {
    delete next.templateId;
  }

  return next;
};

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
    otherwise: Joi.string()
      .trim()
      .when("service", {
        switch: [
          {
            is: "email",
            then: Joi.forbidden().messages({
              "any.unknown": "Message is not allowed for email service",
              "string.empty": "please provide message or commonMessage",
            }),
          },
          {
            is: "whatsapp",
            then: Joi.optional().messages({
              "string.base": "Message must be a string",
              "string.empty": "please provide message or commonMessage",
            }),
          },
        ],
        otherwise: Joi.required().messages({
          "any.required": "Message is required for this service",
          "string.empty": "please provide message or commonMessage",
        }),
      }),
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

  templateId: Joi.string().trim().empty("").optional(),

  variableValues: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
})
  .unknown(false)

  .when(Joi.object({ templateId: Joi.exist() }).unknown(), {
    then: Joi.object({
      message: Joi.forbidden().messages({
        "any.forbidden": "message is not allowed when templateId is provided",
      }),
      body: Joi.forbidden().messages({
        "any.forbidden": "body is not allowed when templateId is provided",
      }),
    }),
    otherwise: Joi.when(
      Joi.object({
        service: Joi.valid("whatsapp"),
        attachments: Joi.exist(),
      }).unknown(),
      {
        then: Joi.object({
          message: Joi.string().allow("").optional(),
        }),
      },
    ),
  })

  .when(Joi.object({ variableValues: Joi.exist() }).unknown(), {
    then: Joi.object({
      templateId: Joi.string().trim().min(1).required().messages({
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

  .when(Joi.object({ service: Joi.valid("sms", "slack") }).unknown(), {
    then: Joi.object().or("message", "templateId"),
  });

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

    // Extract enabling services of client
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

    // Check for enabled services
    services.forEach((service) => {
      let casedService = service.toUpperCase();
      if (!enabledServices.includes(service)) {
        logger.error(
          `ERROR: ${service} is not enabled for ${clientId}. All enabled services for ${clientId} are ${JSON.stringify(enabledServices)}`,
        );

        throw {
          service,
          statusCode: 400,
          message: SERVICES[casedService]
            ? `${service} is not enabled`
            : "Invalid service",
        };
      }
    });

    // Validate the request body service-wise
    for (const [service, body] of Object.entries(sanitizeBody)) {
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
        let next = normalizeEmptyKeys(item);

        const hasTemplateId = isNonEmpty(next.templateId);
        const hasMessage = isNonEmpty(next.message);
        const hasBody = isNonEmpty(next.body);
        const hasCommonMessage = isNonEmpty(commonMessage);

        // Fill from commonMessage only when the key exists but is empty,
        // and only when templateId is not meaningfully present.
        if (
          service !== "email" &&
          hasOwn(item, "message") &&
          !hasMessage &&
          !hasTemplateId &&
          hasCommonMessage
        ) {
          next.message = commonMessage;
        }

        if (
          service === "email" &&
          hasOwn(item, "body") &&
          !hasBody &&
          !hasTemplateId &&
          hasCommonMessage
        ) {
          next.body = commonMessage;
        }

        if (
          next.attachments &&
          typeof next.attachments[0] === "string" &&
          !validPublicURL(next.attachments[0])
        ) {
          messageWithFileAttachmentCount += 1;
        }

        if (next.uniqueKey) {
          uniqueKeySet.add(next.uniqueKey.trim());
        }

        return { ...next, service };
      });

      const { error, value } = validateSchema.validate(
        enrichedBody,
        baseOptions,
      );

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
        logger.error("ERROR: validation failed notify: v2", error);
        throw {
          service,
          statusCode: 400,
          message: cleanJoiMessage(error.details[0]?.message) || error.message,
        };
      }

      sanitizeBody[service] = value;
    }

    req.body = sanitizeBody;
    next();
  } catch (error) {
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
