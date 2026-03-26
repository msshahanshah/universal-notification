const Joi = require("joi");
const { baseOptions } = require("../validators/common.validator");
const { SecretManager } = require("universal_notification_support_lib");

const clientServiceMap = new Map();
async function checkWebhookServicesAreEnabledForClient(
  servicesTrigger,
  clientId,
) {
  try {
    let clientEnabledServicesSet = [];
    if (clientServiceMap.has(clientId)) {
      clientEnabledServicesSet = clientServiceMap[clientId];
    } else {
      const clients = await SecretManager.getSecrets();
      const clientConfig = clients.filter((config) => config.ID == clientId);
      const clientEnabledServices = clientConfig[0]?.ENABLED_SERVERICES;

      clientServiceMap.set(clientId, clientEnabledServices);

      clientEnabledServicesSet = new Set(clientEnabledServices);
      const webhookServices = Object.keys(servicesTrigger);

      for (let serviceName of webhookServices) {
        // check if client has this service or not

        if (!clientEnabledServicesSet.has(serviceName)) {
          throw {
            statusCode: 403,
            message: `${serviceName} service is not allowed `,
          };
        }
      }
    }
  } catch (err) {
    throw err;
  }
}

const baseWebhookSchema = {
  webhookUrl: Joi.string()
    .trim()
    .uri({ scheme: ["https"] })
    .custom((value, helpers) => {
      try {
        const url = new URL(value);

        if (
          url.hostname === "localhost" ||
          url.hostname.startsWith("127.") ||
          url.hostname === "0.0.0.0"
        ) {
          return helpers.error("webhook.localhost");
        }

        return value;
      } catch (err) {
        return helpers.error("string.uri");
      }
    })
    .required()
    .messages({
      "string.base": "webhookUrl must be a string",
      "string.empty": "webhookUrl cannot be empty",
      "string.uri": "webhookUrl must be a valid HTTPS URL",
      "string.uriCustomScheme": "webhookUrl must be a valid HTTPS URL",
      "webhook.localhost": "webhookUrl cannot be a localhost or private URL",
      "any.required": "webhookUrl is required",
    }),

  apiKey: Joi.string().trim().min(1).required().messages({
    "string.base": "apiKey must be a string",
    "string.empty": "apiKey cannot be empty",
    "any.required": "apiKey is required",
  }),

  serviceTrigger: Joi.object()
    .pattern(
      Joi.string(),
      Joi.array().items(
        Joi.string().valid("sent", "success", "failed", "pending"),
      ),
    )
    .min(1)
    .required()
    .messages({
      "object.base": "Invalid servicesTrigger format",
      "object.min": "servicesTrigger object cannot be empty",
      "any.required": "servicesTrigger is required",
    }),

  retryEnabled: Joi.boolean().required().messages({
    "boolean.base": "retryEnabled must be a boolean value",
    "any.required": "retryEnabled is required",
  }),

  isActive: Joi.boolean().strict().required().messages({
    "boolean.base": "isActive must be a boolean",
    "any.required": "isActive is required",
  }),
};

const createWebhookSchema = Joi.object({
  ...baseWebhookSchema,
  webhookUrl: baseWebhookSchema.webhookUrl.required(),
  apiKey: baseWebhookSchema.apiKey.required(),
  serviceTrigger: baseWebhookSchema.serviceTrigger.required(),
  retryEnabled: baseWebhookSchema.retryEnabled.required(),
})
  .unknown(false)
  .messages({
    "object.unknown": "Unknown fields are not allowed",
  });

const updateWebhookSchema = Joi.object(baseWebhookSchema)
  .min(1)
  .unknown(false)
  .messages({
    "object.min": "At least one field must be provided for update",
    "object.unknown": "Unknown fields are not allowed",
  });

const webhookValidation = async (req, res, next) => {
  try {
    if (!req.body) {
      throw {
        statusCode: 422,
        message: "Invalid Content-Type or Request Body",
      };
    }

    const schema =
      req.method === "PATCH" ? updateWebhookSchema : createWebhookSchema;

    const { error, value } = schema.validate(req.body, baseOptions);

    if (error) {
      console.log("Error", error);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const clientId = req.headers["x-client-id"];

    if (value.servicesTrigger) {
      await checkWebhookServicesAreEnabledForClient(
        value.servicesTrigger,
        clientId,
      );
    }

    req.body = value;
    next();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};
module.exports = webhookValidation;
