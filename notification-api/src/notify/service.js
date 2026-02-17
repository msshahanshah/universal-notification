const { default: parsePhoneNumberFromString } = require("libphonenumber-js");
const logger = require("../logger");
const { v4: uuidv4 } = require("uuid");
const rabbitManager = require("../utillity/rabbit");
const { loadClientConfigs } = require("../utillity/loadClientConfigs");

let configs = null;

/**
 * Helpers
 */

const getClientConfig = async (clientId) => {
  configs = configs || (await loadClientConfigs());
  return configs?.find((conf) => conf.ID === clientId);
};

function getDefaultProvider(config, service) {
  const serviceObj = config?.[service?.toUpperCase()];
  if (!serviceObj) return null;

  for (const [provider, providerConfig] of Object.entries(serviceObj)) {
    if (typeof providerConfig === "object" && providerConfig?.default) {
      return provider;
    }
  }
  return null;
}

/**
 * Service Guards
 */

const serviceEnforcers = {
  EMAIL: ({ provider, message, clientConfig }) => {
    if (!provider) return;

    const { service, content, clientId } = message;

    const serviceConfig =
      clientConfig[service.toUpperCase()][provider.toUpperCase()];

    const hasFromEmail = Boolean(content?.fromEmail?.length);
    if (!serviceConfig.allowCustomFromEmail && hasFromEmail) {
      throw {
        statusCode: 400,
        message: `fromEmail is not allowed in ${service} for client ${clientId}`,
      };
    }

    if (serviceConfig.allowCustomFromEmail && !hasFromEmail) {
      throw {
        statusCode: 400,
        message: `fromEmail can't be empty`,
      };
    }

    if (!serviceConfig.allowCustomFromEmail) {
      content.fromEmail = serviceConfig.SENDER_EMAIL;
    }
  },

  SMS: () => {},

  SLACK: () => {},
};

const serviceGuard = (provider, message, clientConfig) => {
  const service = message.service?.toUpperCase();
  serviceEnforcers[service]?.({ provider, message, clientConfig });
};

/**
 * Provider Selection
 */

const selectProvider = async (service, destination, clientId) => {
  const clientConfig = await getClientConfig(clientId);
  const defaultProvider = getDefaultProvider(clientConfig, service);
  try {
    if (service === "sms") {
      const parsed = parsePhoneNumberFromString(destination);
      const countryCode = parsed?.countryCallingCode;

      const dbConnect = await global.connectionManager.getModels(clientId);

      const routingRole = await dbConnect.RoutingRule.findOne({
        where: {
          service: service.toUpperCase(),
          match_value: countryCode,
        },
      });

      return routingRole?.provider || defaultProvider?.toUpperCase();
    }

    if (service === "email") {
      return defaultProvider?.toUpperCase();
    }

    return defaultProvider?.toUpperCase();
  } catch (error) {
    throw {
      statusCode: 400,
      message: error.message,
    };
  }
};

/**
 * Create Notification Records
 */

const creatingNotificationRecord = async (
  clientId,
  service,
  destination,
  content,
  templateId = null,
) => {
  const clientConfig = await getClientConfig(clientId);
  const enabledServices = clientConfig?.ENABLED_SERVERICES;

  if (!Array.isArray(enabledServices)) {
    throw {
      statusCode: 500,
      message: `invalid or missing ENABLED_SERVERICES in client config for ${clientId}`,
    };
  }

  if (!enabledServices.includes(service)) {
    throw {
      statusCode: 403,
      message: `${service} is not enable for client ${clientId}`,
    };
  }

  const dbConnect = await global.connectionManager.getModels(clientId);

  try {
    const results = await Promise.all(
      destination.map(async (number) => {
        /**
         * Service specific enforcement
         */
        const provider = await selectProvider(service, number, clientId);
        serviceGuard(provider, { service, content, clientId }, clientConfig);
        if (service.toLowerCase() === "slack") {
          service = "slackbot";
        }

        content.provider = provider;
        const record = await dbConnect.Notification.create({
          messageId: uuidv4(),
          service,
          destination: number,
          content,
          status: "pending",
          attempts: 0,
          templateId,
        });

        logger.info("Notification record created successfully", {
          number,
          ...record.dataValues,
        });

        return { success: true, number, ...record.dataValues };
      }),
    );

    return results;
  } catch (error) {
    logger.error("Failed to create notification record", {
      error: error.message,
      error,
    });

    if (error.name === "SequelizeUniqueConstraintError") {
      throw {
        statusCode: 409,
        message:
          "Conflict: A notification with this identifier potentially exists.",
      };
    }

    throw {
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to create notification",
    };
  }
};

/**
 * Publish Message
 */

const publishingNotificationRequest = async (notificationRecord) => {
  const {
    service,
    destination,
    content,
    messageId,
    clientId,
    fileId = undefined,
    attachments,
  } = notificationRecord;

  const rabbitConnect = await rabbitManager.getClient(clientId);

  if (!rabbitConnect) return;

  return rabbitConnect.publishMessage(service, {
    service,
    destination,
    content,
    messageId,
    clientId,
    timestamp: new Date().toISOString(),
    provider: content?.provider,
    fileId,
    attachments,
  });
};

/**
 * Fetch Notification
 */

const getNotificationData = async (messageId, clientID) => {
  const dbConnect = await global.connectionManager.getModels(clientID);

  const details = await dbConnect.Notification.findOne({
    where: { messageId },
  });

  if (!details) {
    logger.error("No message found with this MssageID");
    throw new Error("No message found with this MessageID");
  }

  const data = {
    service: details.service,
    destination: details.destination,
    subject: details.content.subject,
    body: details.content.body,
    fromEmail: details.content.fromEmail,
    extension: details.content.extension,
    attachments: details.content.attachments,
  };

  if (details.content.cc) data.cc = details.content.cc;
  if (details.content.bcc) data.bcc = details.content.bcc;

  return data;
};

module.exports = {
  creatingNotificationRecord,
  publishingNotificationRequest,
  getNotificationData,
};
