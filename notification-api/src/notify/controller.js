/**
 * @typedef {Object} NotificationRequest
 * @property {string} templateId - The template id for the notification. Required if service is 'email'.
 * @property {object} message - The message content for the notification. Required if service is 'email'.
 * @property {string} service - The service to use for sending the notification.
 * @property {string} target - The target for the notification.
 */

const {
  creatingNotificationRecord,
  publishingNotificationRequest,
} = require("./service");

const notify = async (req, res) => {
  const { service, destination, message, subject, body, fromEmail } = req.body;
  let content = {};
  if (message) {
    content.message = message;
  } else {
    content.subject = subject;
    content.body = body;
    content.fromEmail = fromEmail;
  }

  const clientID = req.headers["x-client-id"];

  const notificationRecords = await creatingNotificationRecord(
    clientID,
    service,
    destination,
    content
  );

  const successes = notificationRecords.filter(r => r.success);
  const failures = notificationRecords.filter(r => !r.success);

  if (successes.length === 0) {
    const error = failures[0];
    return res.status(error.statusCode || 500).json({
      success: false,
      status: "rejected",
      message: "All notifications failed",
      errors: failures
    });
  }
  successes.forEach(r => r.clientId = clientID);

  const publishResults = await Promise.all(
    successes.map(async (record) => {
      try {
        return await publishingNotificationRequest(record);
      } catch (err) {
        return { success: false, record, message: err.message };
      }
    })
  );

  if (failures.length > 0) {
    return res.status(207).json({
      success: false,
      status: "partial_success",
      message: `Notification request accepted ${publishResults ? "and queued." : ""}`,
      failures,
      success: publishResults
    });
  }

  if (notificationRecords.length === 1) {
    if (notificationRecords[0].statusCode) {
      return res.status(notificationRecords[0].statusCode).json({
        success: false,
        message: notificationRecords[0].message,
        messageId: notificationRecords[0].messageId,
      });
    }
    else {
      return res.status(202).json({
        success: true,
        status: "accepted",
        message: `Notification request accepted ${publishResults ? "and queued." : ""}`,
        messageId: notificationRecords[0].messageId
      });
    }
  }

  return res.status(202).json({
    success: true,
    status: "accepted",
    message: `Notification request accepted ${publishResults ? "and queued." : ""}`,
    messageIds: successes.map(r => r.messageId)
  });
};
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
