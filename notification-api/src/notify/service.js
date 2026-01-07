
const logger = require("../logger");
const { v4: uuidv4 } = require('uuid');
const { publishMessage } = require("../rabbitMQClient");
const { ConnectionManager } = require("../utillity/connectionManager");

const creatingNotificationRecord = async (clientId, service, destination, content, templateId = null) => {
    logger.info(`Creating notification record in DB`, { clientId, service, destination, content, templateId });
    let dbConnect=await global.connectionManager.getModels(clientId);
    return await dbConnect.Notification.create({
        messageId: uuidv4(),
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
    let rabbitConnect=await global.connectionManager.getRabbitMQ(clientId);
    if(rabbitConnect){
       return await rabbitConnect.publishMessage(service, {
            service, destination, content, messageId, clientId,
            timestamp: new Date().toISOString(),
        });
    }
}
module.exports = {
    creatingNotificationRecord,
    publishingNotificationRequest
}