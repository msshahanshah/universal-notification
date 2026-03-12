const Joi = require("joi");
const { baseOptions } = require("../validators/common.validator");
const { SecretManager } = require("@universal-notifier/secret-manager");

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
    .messages({
      "string.base": "webhookUrl must be a string",
      "string.empty": "webhookUrl cannot be empty",
      "string.uriCustomScheme": "webhookUrl must be a valid HTTPS URL",
      "any.required": "webhookUrl is required",
    }),

  apiKey: Joi.string().trim().messages({
    "string.base": "apiKey must be a string",
    "string.empty": "apiKey cannot be empty",
    "any.required": "apiKey is required",
  }),

  servicesTrigger: Joi.object()
    .pattern(Joi.string(), Joi.array().items(Joi.string()))
    .min(1)
    .messages({
      "object.base": "Invalid servicesTrigger format",
      "object.min": "servicesTrigger object cannot be empty",
      "object.pattern.match": "Invalid servicesTrigger format",
      "array.base": "Invalid servicesTrigger format",
      "any.required": "servicesTrigger is required",
    }),

  isActive: Joi.boolean().strict().messages({
    "object.base": "isActive must be boolean",
    "string.empty": "isActive cannot be empty",
    "any.required": "isActive is required",
  }),
};

const createWebhookSchema = Joi.object({
  ...baseWebhookSchema,
  webhookUrl: baseWebhookSchema.webhookUrl.required(),
  apiKey: baseWebhookSchema.apiKey.required(),
  servicesTrigger: baseWebhookSchema.servicesTrigger.required(),
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
