const { default: parsePhoneNumberFromString } = require("libphonenumber-js");
const logger = require("../logger");
const { v4: uuidv4 } = require("uuid");
const { publishMessage } = require("../rabbitMQClient");
const { ConnectionManager } = require("../utillity/connectionManager");
const {
  RabbitMQManager,
  SecretManager,
} = require("@universal-notifier/secret-manager");
const rabbitManager = require("../utillity/rabbit");

const creatingNotificationRecord = async (
  clientId,
  service,
  destination,
  content,
  templateId = null,
) => {
  // logger.info(`Creating notification record in DB`, {
  //   clientId,
  //   service,
  //   destination,
  //   content,
  //   templateId,
  // });
  let dbConnect = await global.connectionManager.getModels(clientId);
  return await dbConnect.Notification.create({
    messageId: uuidv4(),
    service: service,
    destination: destination,
    content: content,
    status: "pending", // Initial status
    attempts: 0,
    templateId: templateId,
  })
    .then((record) => {
      logger.info(
        `Notification record created successfully`,
        record.dataValues,
      );
      return record.dataValues;
    })
    .catch((dbError) => {
      logger.error("Database error: Failed to create notification record", {
        error: dbError.message,
        stack: dbError.stack,
      });

      if (dbError.name === "SequelizeUniqueConstraintError") {
        return {
          statusCode: 409,
          message:
            "Conflict: A notification with this identifier potentially exists.",
        };
      }
      return {
        statusCode: 500,
        message: "Failed to create notification record in database.",
        error: dbError.message,
      };
    });
};

const selectProvider = async (service, destination, clientId) => {
  try {
    const countryCode =
      parsePhoneNumberFromString(destination).countryCallingCode;
    let dbConnect = await global.connectionManager.getModels(clientId);
    const provider = await dbConnect.RoutingRule.findOne({
      where: {
        service: service.toUpperCase(),
        match_value: countryCode,
      },
    });
    return provider?.provider;
  } catch (error) {
    return {
      statusCode: 400,
      message: error.message,
    };
  }
};

const publishingNotificationRequest = async (notificationRecord) => {
  let {
    service,
    destination,
    content,
    messageId,
    clientId,
    fileId = undefined,
  } = notificationRecord;
  const provider = await selectProvider(service, destination, clientId);

  const rabbitConnect = await rabbitManager.getClient(clientId);

  if (service.toLowerCase() === "slack") {
    service = "slackbot";
  }
  if (rabbitConnect) {
    const result = await rabbitConnect.publishMessage(service, {
      service,
      destination,
      content,
      messageId,
      clientId,
      timestamp: new Date().toISOString(),
      provider,
      fileId,
    });

    return result;
  }
};

const getNotificationData = async (messageId, clientID) => {
  let dbConnect = await global.connectionManager.getModels(clientID);
  const details = await dbConnect.Notification.findOne({
    where: {
      messageId: messageId,
    },
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

  if (details.content.cc) {
    data.cc = details.content.cc;
  }
  if (details.content.bcc) {
    data.bcc = details.content.bcc;
  }
  return data;
};

module.exports = {
  creatingNotificationRecord,
  publishingNotificationRequest,
  getNotificationData,
};
