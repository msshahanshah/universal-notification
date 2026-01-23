const logger = require("../logger");
const { v4: uuidv4 } = require("uuid");
const { publishMessage } = require("../rabbitMQClient");
const { ConnectionManager } = require("../utillity/connectionManager");
const { parsePhoneNumber, default: parsePhoneNumberFromString } = require("libphonenumber-js");


const creatingNotificationRecord = async (
  clientId,
  service,
  destination,
  content,
  templateId = null
) => {
  logger.info(`Creating notification record in DB`, {
    clientId,
    service,
    destination,
    content,
    templateId,
  });
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
        record.dataValues
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
    const countryCode = parsePhoneNumberFromString(destination).countryCallingCode;
    let dbConnect = await global.connectionManager.getModels(clientId);
    const provider = await dbConnect.RoutingRule.findOne({
      where: {
        service: service.toUpperCase(),
        match_value: countryCode
      }
    })
    return provider?.provider;
  } catch (error) {
    return {
      statusCode: 400,
      message: error.message,
    };
  }
}

const publishingNotificationRequest = async (notificationRecord) => {
  let { service, destination, content, messageId, clientId } =
    notificationRecord;
  const provider = await selectProvider(service, destination, clientId);
  let rabbitConnect = await global.connectionManager.getRabbitMQ(clientId);
  if (rabbitConnect) {
    const result = await rabbitConnect.publishMessage(service, {
      service,
      destination,
      content,
      messageId,
      clientId,
      timestamp: new Date().toISOString(),
      provider
    });

    return result;
  }
};

module.exports = {
  creatingNotificationRecord,
  publishingNotificationRequest,
};
