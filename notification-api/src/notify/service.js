const db = require("../../models");
const logger = require("../logger");
const { v4: uuidv4 } = require('uuid');
const { publishMessage } = require("../rabbitMQClient");

const creatingNotificationRecord = async (clientId, service, destination, content, templateId = null) => {
    logger.info(`Creating notification record in DB`, { clientId, service, destination, content, templateId });
    return await db.Notification.create({
        messageId: uuidv4(),
        clientId: clientId,
        service: service,
        destination: destination,
        content: content,
        status: 'pending', // Initial status
        attempts: 0,
        templateId: templateId,
    }).then((record) => {

        logger.info(`Notification record created successfully`, record.dataValues);
        return record.dataValues;
    }).catch((dbError) => {
        logger.error('Database error: Failed to create notification record', {
            error: dbError.message,
            stack: dbError.stack,
        });

        if (dbError.name === 'SequelizeUniqueConstraintError') {
            return {
                statusCode: 409,
                message: 'Conflict: A notification with this identifier potentially exists.'
            }
        }
        return {
            statusCode: 500,
            message: 'Failed to create notification record in database.',
            messageId,
        }
    });

}
const publishingNotificationRequest = async (notificationRecord) => {
    let { service, destination, content, messageId, clientId } = notificationRecord;
   return await publishMessage(service, {
        service, destination, content, messageId, clientId,
        timestamp: new Date().toISOString(),
    });
}
module.exports = {
    creatingNotificationRecord,
    publishingNotificationRequest
}