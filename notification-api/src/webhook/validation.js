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
    .messages({
      "string.base": "webhookUrl must be a string",
      "string.empty": "webhookUrl cannot be empty",
      "string.uri": "webhookUrl must be a valid HTTPS URL",
      "string.uriCustomScheme": "webhookUrl must be a valid HTTPS URL",
      "webhook.localhost": "webhookUrl cannot be a localhost or private URL",
    }),

  apiKey: Joi.string().trim().min(1).messages({
    "string.base": "apiKey must be a string",
    "string.empty": "apiKey cannot be empty",
  }),

  serviceTrigger: Joi.object()
    .pattern(
      Joi.string(),
      Joi.array().items(
        Joi.string().valid("sent", "success", "failed", "pending"),
      ),
    )
    .min(1)
    .messages({
      "object.base": "Invalid servicesTrigger format",
      "object.min": "servicesTrigger object cannot be empty",
    }),

  retryEnabled: Joi.boolean().messages({
    "boolean.base": "retryEnabled must be a boolean value",
  }),

  isActive: Joi.boolean().strict().messages({
    "boolean.base": "isActive must be a boolean",
  }),
};

const createWebhookSchema = Joi.object({
  webhookUrl: baseWebhookSchema.webhookUrl.required().messages({
    "any.required": "webhookUrl is required",
  }),

  apiKey: baseWebhookSchema.apiKey.required().messages({
    "any.required": "apiKey is required",
  }),

  serviceTrigger: baseWebhookSchema.serviceTrigger.required().messages({
    "any.required": "servicesTrigger is required",
  }),

  retryEnabled: baseWebhookSchema.retryEnabled,

  isActive: baseWebhookSchema.isActive,
})
  .unknown(false)
  .messages({
    "object.unknown": "Unknown fields are not allowed",
  });

const updateWebhookSchema = Joi.object({
  webhookUrl: baseWebhookSchema.webhookUrl,
  apiKey: baseWebhookSchema.apiKey,
  serviceTrigger: baseWebhookSchema.serviceTrigger,
  retryEnabled: baseWebhookSchema.retryEnabled,
  isActive: baseWebhookSchema.isActive,
})
  .min(1)
  .unknown(false)
  .messages({
    "object.min": "At least one field must be provided for update",
    "object.unknown": "Unknown fields are not allowed",
  });

const queryValidationSchema = Joi.object({
  page: Joi.number()
    .min(1)
    .custom((value, helpers) => {
      const raw = helpers.original;
      // Reject decimal representation like "1.0", "2.5"
      if (typeof raw === "string" && !/^[0-9]+$/.test(raw)) {
        return helpers.error("number.integer");
      }
      return value;
    })
    .integer()
    .optional()
    .messages({
      "number.base": "Page must be a number",
      "number.integer": "Page must be an integer",
      "number.min": "Page must be at least 1",
      "number.unsafe": "Page must be a valid integer",
    }),
  limit: Joi.number()
    .min(1)
    .custom((value, helpers) => {
      const raw = helpers.original;
      // Reject decimal representation like "1.0", "2.5"
      if (typeof raw === "string" && !/^[0-9]+$/.test(raw)) {
        return helpers.error("number.integer");
      }
      return value;
    })
    .integer()
    .max(100)
    .optional()
    .messages({
      "number.base": "Limit must be a number",
      "number.integer": "Limit must be an integer",
      "number.min": "Limit must be at least 1",
      "number.max": "Limit cannot exceed 100",
      "number.unsafe": "Limit must be a valid integer",
    }),
  fields: Joi.string(),
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

const queryValidation = (req, res, next) => {
  try {
    const { error, value } = queryValidationSchema.validate(
      req.query,
      baseOptions,
    );
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    // proceed
    next();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};
module.exports = { webhookValidation, queryValidation };
