const { default: parsePhoneNumberFromString } = require("libphonenumber-js");
const logger = require("../../logger");
const { v4: uuidv4 } = require("uuid");
const rabbitManager = require("../../utillity/rabbit");
const { loadClientConfigs } = require("../../utillity/loadClientConfigs");
const {
  generatePreSignedUrl,
} = require("../../../helpers/preSignedUrl.helper");

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

  for (let i in notificationRecords) {
    let preSignedUrls = [];
    const msg = notificationRecords[i];
    const attachments = msg.content?.attachments;
    if (attachments?.length && typeof attachments[0] === "string") {
      try {
        preSignedUrls = await generatePreSignedUrl(
          clientId,
          msg.messageId,
          attachments,
        );
      } catch (error) {
        console.log("failed to publish message", error);
      }

      // add presigned url to the msg
      notificationRecords[i] = { ...msg, clientId, preSignedUrls };
    } else {
      notificationRecords[i] = { ...msg, clientId };
    }
  }
  console.log("sanitized presigned >>", notificationRecords);
  // publish the messges which don't have attachments
  const t = await Promise.all(
    notificationRecords
      .filter((record) => !record.preSignedUrls?.length)
      .map((record) =>
        publishingNotificationRequest(record)
          .then(() => ({ success: true }))
          .catch((err) => ({ success: false, error: err.message })),
      ),
  );

  // sanitize the message details

  for (let i in notificationRecords) {
    const msg = notificationRecords[i];
    notificationRecords[i] = { messageId: msg.messageId };
    if (msg.preSignedUrls) {
      notificationRecords[i] = {
        ...notificationRecords[i],
        preSignedUrls: msg.preSignedUrls,
      };
    }
  }

  return {
    service,
    messages: notificationRecords,
    // publishResults,
  };
}

/**
 * Create Notification Records
 */

async function creatingNotificationRecord(
  clientId,
  service,
  destination,
  content,
  templateId = null,
) {
  const clientConfig = await getClientConfig(clientId);
  const enabledServices = clientConfig?.ENABLED_SERVERICES;

  if (!Array.isArray(enabledServices)) {
    throw {
      statusCode: 400,
      message: `invalid or missing ENABLED_SERVERICES in client config for ${clientId}`,
    };
  }

  if (!enabledServices.includes(service)) {
    throw {
      statusCode: 400,
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
}

/**
 * Create Bulk Record
 */

async function creatingBulkNotificationRecord(clientId, service, messages) {
  console.log("calling >>>", service);
  const clientConfig = await getClientConfig(clientId);
  const enabledServices = clientConfig?.ENABLED_SERVERICES;

  if (!Array.isArray(enabledServices)) {
    throw {
      statusCode: 400,
      message: `invalid or missing ENABLED_SERVERICES in client config for ${clientId}`,
    };
  }

  if (!enabledServices.includes(service)) {
    throw {
      statusCode: 400,
      message: `${service} is not enable for client ${clientId}`,
    };
  }

  const dbConnect = await global.connectionManager.getModels(clientId);
  const records = [];

  try {
    for (const msg of messages) {
      const { destination, content, templateId } = msg;

      for (const number of destination) {
        const provider = await selectProvider(service, number, clientId);

        serviceGuard(provider, { service, content, clientId }, clientConfig);

        const normalizedService =
          service.toLowerCase() === "slack" ? "slackbot" : service;

        records.push({
          messageId: uuidv4(),
          service: normalizedService,
          destination: number,
          content: { ...content, provider },
          status: "pending",
          attempts: 0,
          templateId,
        });
      }
    }

    await dbConnect.Notification.bulkCreate(records);

    return records;
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
}

/**
 * Helpers
 */

async function getClientConfig(clientId) {
  configs = configs || (await loadClientConfigs());
  return configs?.find((conf) => conf.ID === clientId);
}

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
    // throw {
    //   statusCode: 400,
    //   message: `fromEmail is not allowed in  for client $ `,
    // };
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

function serviceGuard(provider, message, clientConfig) {
  const service = message.service?.toUpperCase();
  serviceEnforcers[service]?.({ provider, message, clientConfig });
}

/**
 * Provider Selection
 */

async function selectProvider(service, destination, clientId) {
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
}
/**
 * Publish Message
 */

async function publishingNotificationRequest(notificationRecord) {
  console.log("publishing record >>>", notificationRecord);
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
}

/**
 * Fetch Notification
 */

async function getNotificationData(messageId, clientID) {
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
}

module.exports = {
  creatingNotificationRecord,
  publishingNotificationRequest,
  getNotificationData,
  notifyService,
};

// async function creatingBulkNotificationRecord(clientId, service, messages) {
//   const clientConfig = await getClientConfig(clientId);
//   const enabledServices = clientConfig?.ENABLED_SERVERICES;

//   if (!Array.isArray(enabledServices)) {
//     throw {
//       statusCode: 400,
//       message: `invalid or missing ENABLED_SERVERICES in client config for ${clientId}`,
//     };
//   }

//   if (!enabledServices.includes(service)) {
//     throw {
//       statusCode: 400,
//       message: `${service} is not enable for client ${clientId}`,
//     };
//   }

//   const dbConnect = await global.connectionManager.getModels(clientId);
//   const records = [];

//   try {
//     for (const msg of messages) {
//       const {
//         clientId,
//         service,
//         destination,
//         content,
//         attachments,
//         templateId,
//       } = msg;

//       for (const number of destination) {
//         /**
//          * Service specific enforcement
//          */
//         const provider = await selectProvider(service, number, clientId);
//         serviceGuard(provider, { service, content, clientId }, clientConfig);
//         if (service.toLowerCase() === "slack") {
//           service = "slackbot";
//         }

//         content.provider = provider;
//         records.push({
//           messageId: uuidv4(),
//           service,
//           destination: number,
//           content,
//           status: "pending",
//           attempts: 0,
//           templateId,
//         });
//       }
//     }

//     // Insert in DB
//     const dbResponse = await dbConnect.Notification.bulkCreate(records);
//     return dbResponse;
//   } catch (error) {
//     logger.error("Failed to create notification record", {
//       error: error.message,
//       error,
//     });

//     if (error.name === "SequelizeUniqueConstraintError") {
//       throw {
//         statusCode: 409,
//         message:
//           "Conflict: A notification with this identifier potentially exists.",
//       };
//     }

//     throw {
//       statusCode: error.statusCode || 500,
//       message: error.message || "Failed to create notification",
//     };
//   }
// }

// async function notifyService(
//   clientID,
//   service,
//   destination,
//   content,
//   attachments,
// ) {
//   const notificationRecords = await creatingNotificationRecord(
//     clientID,
//     service,
//     destination,
//     content,
//   );

//   notificationRecords.forEach((record) => {
//     record.clientId = clientID;
//   });

//   let preSignedUrls;
//   if (attachments?.length && typeof attachments[0] === "string") {
//     preSignedUrls = await generatePreSignedUrl(
//       clientID,
//       notificationRecords[0].messageId,
//       attachments,
//     );

//     return { notificationRecords, preSignedUrls };
//   }

//   const publishResults = await Promise.all(
//     notificationRecords.map((record) =>
//       publishingNotificationRequest(record)
//         .then(() => ({ success: true }))
//         .catch((err) => ({ success: false, error: err.message })),
//     ),
//   );

//   return {
//     notificationRecords,
//     publishResults,
//     preSignedUrls,
//   };
// }
