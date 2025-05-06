/**
 * @typedef {Object} NotificationRequest
 * @property {string} templateId - The template id for the notification. Required if service is 'email'.
 * @property {object} message - The message content for the notification. Required if service is 'email'.
 * @property {string} service - The service to use for sending the notification.
 * @property {string} target - The target for the notification.
 */

const { creatingNotificationRecord, publishingNotificationRequest } = require("./service");

const notify = async (req, res) => {
    const { service, destination, message, subject, body } = req.body;
    let content = {}
    if(message){
        content.message=message
    }else {
        content.subject=subject
        content.body=body
    }

    const clientID = req.headers['x-client-id'];
    
    const notificationRecord = await creatingNotificationRecord(clientID, service, destination, content)
    if (notificationRecord.statusCode) {
        return res.status(notificationRecord.statusCode).json({
            error: notificationRecord.message,
            messageId: notificationRecord.messageId,
        });
    }
    notificationRecord.clientId=clientID
    let result = await publishingNotificationRequest(notificationRecord)

    return res.status(202).json({
        status: 'accepted',
        message: `Notification request accepted ${result ? 'and queued.' : ''}`,
        messageId: notificationRecord.messageId, // Return the ID to the client
    });
}
module.exports = notify;


// app.post('/notify', async (req, res) => {



//     // Validation
//     if (!service || !targetChannel || !message) {
//         logger.warn('Validation failed: Missing fields', { body: req.body, messageId });
//         return res.status(400).json({
//             error: 'Missing required fields: service, channel, message',
//         });
//     }
//     const allowedServices = ['slack', 'email', 'telegram'];
//     const lowerCaseService = service.toLowerCase();

//     // Validate email specific fields
//     if (lowerCaseService === 'email') {
//         if (!req.body.templateId) {
//             logger.warn('Validation failed: Missing templateId for email', { body: req.body, messageId });
//             return res.status(400).json({ error: 'Missing templateId for email service' });
//         }
//         if (!message) {
//             logger.warn('Validation failed: Missing message for email service', { body: req.body, messageId });
//             return res.status(400).json({ error: 'Missing message for email service' });
//         }

//         if (typeof message !== 'object' || message === null) {
//             logger.warn('Validation failed: message is not an object for email service', { body: req.body, messageId });
//             return res.status(400).json({ error: 'Invalid message format: must be an object for email service' });
//         }
//     }
//     if (!allowedServices.includes(lowerCaseService)) {
//         logger.warn('Validation failed: Invalid service', { service, messageId });
//         return res.status(400).json({
//             error: `Invalid service specified. Allowed services are: ${allowedServices.join(', ')}`,
//         });
//     }





//     try {


//         res.status(202).json({
//             status: 'accepted',
//             message: 'Notification request accepted and queued.',
//             messageId: messageId, // Return the ID to the client
//         });

//     } catch (publishError) {
//         logger.error('RabbitMQ error: Failed to publish notification request', {
//             messageId,
//             dbId: notificationRecord.id,
//             error: publishError.message,
//             stack: publishError.stack
//         });
//         try {
//             await notificationRecord.update({
//                 status: 'failed',
//                 connectorResponse: `Failed to publish to RabbitMQ: ${publishError.message}`
//             });
//             logger.warn(`Updated notification status to 'failed' due to publish error`, { messageId, dbId: notificationRecord.id });
//         } catch (updateError) {
//             logger.error('DB error: Failed to update notification status to "failed" after publish error', {
//                 messageId,
//                 dbId: notificationRecord.id,
//                 updateError: updateError.message,
//                 stack: updateError.stack
//             });
//         }

//         res.status(500).json({ error: 'Failed to queue notification request after saving.' });
//     }
// });