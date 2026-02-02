const logger = require("../logger");
const { v4: uuidv4 } = require("uuid");
const { publishMessage } = require("../rabbitMQClient");
const { ConnectionManager } = require("../utillity/connectionManager");

const creatingNotificationRecord = async (
  clientId,
  service,
  destination,
  content,
  templateId = null,
) => {
  logger.info(`Creating notification record in DB`, {
    clientId,
    service,
    destination,
    content,
    templateId,
  });
  let dbConnect = await global.connectionManager.getModels(clientId);
  //saving the records in db
  const destinations = destination.split(',');

  const results = await Promise.all(
    destinations.map(async (number) => {
      try {
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

        return {
          success: true,
          number,
          ...record.dataValues,
        };
      } catch (dbError) {
        logger.error("Database error: Failed to create notification record", {
          number,
          error: dbError.message,
        });

        if (dbError.name === "SequelizeUniqueConstraintError") {
          return {
            success: false,
            number,
            statusCode: 409,
            message:
              "Conflict: A notification with this identifier potentially exists.",
          };
        }

        return {
          success: false,
          number,
          statusCode: 500,
          message: "Failed to create notification",
          error: dbError.message,
        };
      }
    })
  );

  return results; 
}

const publishingNotificationRequest = async (notificationRecord) => {
  let { service, destination, content, messageId, clientId } =
    notificationRecord;
  let rabbitConnect = await global.connectionManager.getRabbitMQ(clientId);
  if (rabbitConnect) {
    const result = await rabbitConnect.publishMessage(service, {
      service,
      destination,
      content,
      messageId,
      clientId,
      timestamp: new Date().toISOString(),
    });

    return result;
  }
};

module.exports = {
  creatingNotificationRecord,
  publishingNotificationRequest,
};
