const { default: parsePhoneNumberFromString } = require("libphonenumber-js");
const logger = require("../../logger");
const { v4: uuidv4 } = require("uuid");
const rabbitManager = require("../../utillity/rabbit");
const { loadClientConfigs } = require("../../utillity/loadClientConfigs");
const {
  generatePreSignedUrl,
} = require("../../../helpers/preSignedUrl.helper");
const { validPublicURL } = require("../../../helpers/regex.helper");

let configs = null;

/**
 *  Main service
 */

async function notifyService(clientId, service, bulkMessages) {
  const notificationRecords = await creatingBulkNotificationRecord(
    clientId,
    service,
    bulkMessages,
  );

  logger.info(
    `[NOTIFY-SERVICE] Bulk notification records created | clientId: ${clientId}, count: ${notificationRecords.length}`,
  );

  for (let i in notificationRecords) {
    let preSignedUrls = [];
    const msg = notificationRecords[i];
    const attachments = msg.content?.attachments;

    // Generate Presigned Urls
    if (
      attachments?.length &&
      typeof attachments[0] === "string" &&
      !validPublicURL(attachments[0])
    ) {
      logger.info(
        `[NOTIFY-SERVICE] Generating pre-signed URLs | messageId: ${msg.messageId}, attachmentCount: ${attachments.length}`,
      );

      try {
        preSignedUrls = await generatePreSignedUrl(
          clientId,
          msg.messageId,
          attachments,
        );
        logger.info(
          `[NOTIFY-SERVICE] Pre-signed URLs generated successfully | messageId: ${msg.messageId}, urlCount: ${preSignedUrls.length}`,
        );
      } catch (error) {
        logger.error(
          `[NOTIFY-SERVICE] Failed to generate pre-signed URLs | messageId: ${msg.messageId}, clientId: ${clientId}, error: ${error.message}`,
        );
        throw { statusCode: 500, message: "failed to create presigned urls" };
      }

      // add presigned url to the msg
      notificationRecords[i] = {
        ...msg,
        clientId,
        preSignedUrls,
      };
    } else {
      notificationRecords[i] = { ...msg, clientId };
    }
  }

  const recordsWithoutAttachments = notificationRecords.filter(
    (record) => !record.preSignedUrls?.length,
  );
  logger.info(
    `[NOTIFY-SERVICE] Publishing ${recordsWithoutAttachments.length} message(s) without attachments | clientId: ${clientId}`,
  );

  // publish the messages which don't have attachments
  const t = await Promise.all(
    recordsWithoutAttachments.map((record) =>
      publishingNotificationRequest(record)
        .then(() => {
          logger.info(
            `[NOTIFY-SERVICE] Message published successfully | messageId: ${record.messageId}, service: ${service}`,
          );
          return { success: true };
        })
        .catch((err) => {
          logger.error(
            `[NOTIFY-SERVICE] Failed to publish message | messageId: ${record.messageId}, service: ${service}, error: ${JSON.stringify(err)}`,
          );
          return { success: false, error: err.message };
        }),
    ),
  );

  // prepare Presigned array
  const preSignedUrls = [];
  for (let i in notificationRecords) {
    const msg = notificationRecords[i];
    const { uniqueKey } = msg.content;
    notificationRecords[i] = { messageId: msg.messageId };
    if (msg.preSignedUrls) {
      preSignedUrls.push({ uniqueKey, urls: msg.preSignedUrls });
    }
  }

  logger.info(
    `[NOTIFY-SERVICE] Notify service completed | clientId: ${clientId}, service: ${service}, preSignedUrlGroups: ${preSignedUrls.length}`,
  );

  return {
    service,
    messages: notificationRecords,
    preSignedUrls,
  };
}

/**
 * Create Bulk Record
 */

async function creatingBulkNotificationRecord(clientId, service, messages) {
  logger.info(
    `[NOTIFY-SERVICE] Loading client config | clientId: ${clientId}, service: ${service}`,
  );

  const clientConfig = await getClientConfig(clientId);
  const enabledServices = clientConfig?.ENABLED_SERVERICES;

  if (!Array.isArray(enabledServices)) {
    logger.warn(
      `[NOTIFY-SERVICE] Invalid or missing ENABLED_SERVERICES in client config | clientId: ${clientId}`,
    );
    throw {
      statusCode: 400,
      message: `invalid or missing ENABLED_SERVERICES in client config for ${clientId}`,
    };
  }

  if (!enabledServices.includes(service)) {
    logger.warn(
      `[NOTIFY-SERVICE] Service not enabled for client | clientId: ${clientId}, service: ${service}, enabledServices: ${enabledServices.join(", ")}`,
    );
    throw {
      statusCode: 400,
      message: `${service} is not enable for client ${clientId}`,
    };
  }

  const dbConnect = await global.connectionManager.getModels(clientId);
  const records = [];

  try {
    for (const msg of messages) {
      const { destination, content, templateId, variableValues } = msg;

      for (const number of destination) {
        logger.debug(
          `[NOTIFY-SERVICE] Selecting provider | clientId: ${clientId}, service: ${service}, destination: ${number}`,
        );

        const provider = await selectProvider(service, number, clientId);

        logger.debug(
          `[NOTIFY-SERVICE] Provider selected | clientId: ${clientId}, service: ${service}, destination: ${number}, provider: ${provider}`,
        );

        serviceGuard(provider, { service, content, clientId }, clientConfig);
        records.push({
          messageId: uuidv4(),
          service,
          destination: number,
          content: { ...content, provider },
          status: "pending",
          attempts: 0,
          templateId,
          variableValues
        });
      }
    }

    await dbConnect.Notification.bulkCreate(records);
    logger.info(
      `[NOTIFY SERVICE] Notification Records created successfully: service: ${service}, clientId: ${clientId}`,
    );
    return records;
  } catch (error) {
    logger.error(
      `Failed to create notification record. Client: ${clientId}, Service: ${service}, Error: ${JSON.stringify(error)}`,
    );

    if (error.name === "SequelizeUniqueConstraintError") {
      logger.warn(
        `[NOTIFY-SERVICE] Duplicate notification detected | clientId: ${clientId}, service: ${service}`,
      );
      throw {
        statusCode: 409,
        message:
          "Conflict: A notification with this identifier potentially exists.",
      };
    }

    throw {
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to create notification",
      service,
    };
  }
}

/**
 * Helpers
 */

async function getClientConfig(clientId) {
  if (!configs) {
    logger.debug(
      `[NOTIFY-SERVICE] Client configs cache miss, loading from source | clientId: ${clientId}`,
    );
    configs = await loadClientConfigs();
  }
  const config = configs?.find((conf) => conf.ID === clientId);
  if (!config) {
    logger.warn(`[NOTIFY-SERVICE] No config found for clientId: ${clientId}`);
  }
  return config;
}

function getDefaultProvider(config, service) {
  const serviceObj = config?.[service?.toUpperCase()];
  if (!serviceObj) {
    logger.warn(
      `[NOTIFY-SERVICE] No service config found | service: ${service}`,
    );
    return null;
  }

  for (const [provider, providerConfig] of Object.entries(serviceObj)) {
    if (typeof providerConfig === "object" && providerConfig?.default) {
      logger.debug(
        `[NOTIFY-SERVICE] Default provider resolved | service: ${service}, provider: ${provider}`,
      );
      return provider;
    }
  }

  logger.warn(
    `[NOTIFY-SERVICE] No default provider configured | service: ${service}`,
  );
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
      logger.warn(
        `[NOTIFY-SERVICE] Custom fromEmail not allowed | clientId: ${clientId}, service: ${service}, provider: ${provider}`,
      );
      throw {
        statusCode: 400,
        message: `fromEmail is not allowed in ${service} for client ${clientId}`,
      };
    }

    if (serviceConfig.allowCustomFromEmail && !hasFromEmail) {
      logger.warn(
        `[NOTIFY-SERVICE] fromEmail is required but missing | clientId: ${clientId}, service: ${service}, provider: ${provider}`,
      );
      throw {
        statusCode: 400,
        message: `fromEmail can't be empty`,
      };
    }

    if (!serviceConfig.allowCustomFromEmail) {
      logger.debug(
        `[NOTIFY-SERVICE] Applying default sender email | clientId: ${clientId}, provider: ${provider}`,
      );
      content.fromEmail = serviceConfig.SENDER_EMAIL;
    }
  },

  SMS: () => {},

  SLACK: () => { },

  WHATSAPP: ({ provider, message, clientConfig }) => {
    if (!provider) return;
    const { service, content, clientId } = message;
    const serviceConfig =
      clientConfig[service.toUpperCase()][provider.toUpperCase()];
    const hasFromWhatsNumber = Boolean(content?.fromNumber);

    if (!serviceConfig.allowCustomFromNumber && hasFromWhatsNumber) {
      logger.warn(
        `[NOTIFY-SERVICE] Custom fromNumber not allowed | clientId: ${clientId}, service: ${service}, provider: ${provider}`,
      );
      throw {
        statusCode: 400,
        message: `fromNumber is not allowed in ${service} for client ${clientId}`,
      };
    }

    if (serviceConfig.allowCustomFromNumber && !hasFromWhatsNumber) {
      logger.warn(
        `[NOTIFY-SERVICE] fromNumber is required but missing | clientId: ${clientId}, service: ${service}, provider: ${provider}`,
      );
      throw {
        statusCode: 400,
        message: `fromNumber can't be empty`,
      };
    }

    if (!serviceConfig.allowCustomFromNumber) {
      logger.debug(
        `[NOTIFY-SERVICE] Applying default fromNumber | clientId: ${clientId}, provider: ${provider}`,
      );
      content.fromNumber = serviceConfig.TO_NUMBER;
    }
  },
};

function serviceGuard(provider, message, clientConfig) {
  const service = message.service?.toUpperCase();
  logger.debug(
    `[NOTIFY-SERVICE] Running service guard | service: ${service}, provider: ${provider}`,
  );
  serviceEnforcers[service]?.({ provider, message, clientConfig });
}

/**
 * Provider Selection
 */

async function selectProvider(service, destination, clientId) {
  logger.debug(
    `[NOTIFY-SERVICE] Selecting provider | clientId: ${clientId}, service: ${service}, destination: ${destination}`,
  );

  const clientConfig = await getClientConfig(clientId);
  const defaultProvider = getDefaultProvider(clientConfig, service);

  try {
    if (service === "sms") {
      const parsed = parsePhoneNumberFromString(destination);
      const countryCode = parsed?.countryCallingCode;

      logger.debug(
        `[NOTIFY-SERVICE] SMS routing lookup | clientId: ${clientId}, destination: ${destination}, countryCode: ${countryCode}`,
      );

      const dbConnect = await global.connectionManager.getModels(clientId);

      const routingRole = await dbConnect.RoutingRule.findOne({
        where: {
          service: service.toUpperCase(),
          match_value: countryCode,
        },
      });

      const provider = routingRole?.provider || defaultProvider?.toUpperCase();
      logger.info(
        `[NOTIFY-SERVICE] SMS provider resolved | clientId: ${clientId}, countryCode: ${countryCode}, provider: ${provider}, usedRoutingRule: ${Boolean(routingRole)}`,
      );
      return provider;
    }

    if (service === "email") {
      logger.info(
        `[NOTIFY-SERVICE] Email provider resolved | clientId: ${clientId}, provider: ${defaultProvider?.toUpperCase()}`,
      );
      return defaultProvider?.toUpperCase();
    }

    if (service === "whatsapp") {
      logger.info(
        `[NOTIFY-SERVICE] WhatsApp provider resolved | clientId: ${clientId}, provider: ${defaultProvider?.toUpperCase()}`,
      );
      return defaultProvider?.toUpperCase();
    }

    logger.info(
      `[NOTIFY-SERVICE] Provider resolved via fallback | clientId: ${clientId}, service: ${service}, provider: ${defaultProvider?.toUpperCase()}`,
    );
    return defaultProvider?.toUpperCase();
  } catch (error) {
    logger.error(
      `[NOTIFY-SERVICE] Failed to select provider | clientId: ${clientId}, service: ${service}, destination: ${destination}, error: ${error.message}`,
    );
    throw {
      statusCode: 400,
      message: error.message,
    };
  }
}

/**
 * Publish Message
 */

async function publishingNotificationRequest(notificationRecord) {
  const {
    service,
    destination,
    content,
    messageId,
    clientId,
    fileId = undefined,
    attachments,
    templateId,
    variableValues
  } = notificationRecord;

  logger.info(
    `[NOTIFY-SERVICE] Publishing notification request | clientId: ${clientId}, service: ${service}, messageId: ${messageId}, destination: ${destination}`,
  );

  const rabbitConnect = await rabbitManager.getClient(clientId);

  if (!rabbitConnect) {
    logger.warn(
      `[NOTIFY-SERVICE] RabbitMQ client unavailable, skipping publish | clientId: ${clientId}, messageId: ${messageId}`,
    );
    return;
  }

  let updatedService = service;
  if (service.toLowerCase() === "slack") {
    updatedService = "slackbot";
    logger.debug(
      `[NOTIFY-SERVICE] Remapped service name slack -> slackbot | messageId: ${messageId}`,
    );
  }

  logger.debug(
    `[NOTIFY-SERVICE] Dispatching to RabbitMQ | clientId: ${clientId}, service: ${updatedService}, messageId: ${messageId}`,
  );

  return rabbitConnect.publishMessage(updatedService, {
    service: updatedService,
    destination,
    content,
    messageId,
    clientId,
    timestamp: new Date().toISOString(),
    provider: content?.provider,
    fileId,
    attachments,
    templateId,
    variableValues
  });
}

module.exports = {
  publishingNotificationRequest,
  notifyService,
};
