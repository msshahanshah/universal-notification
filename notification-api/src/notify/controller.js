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
  getNotificationData,
} = require('./service');

const { generatePreSignedUrl } = require('../../helpers/preSignedUrl');
const { downloadS3File } = require('../../helpers/downloadFile');

const notify = async (req, res) => {
  const {
    service,
    destination,
    message,
    subject,
    body,
    fromEmail,
    cc,
    bcc,
    attachments,
    extension,
  } = req.body;
  let content = {};
  if (message) {
    content.message = message;
  } else {
    content.subject = subject;
    content.body = body;
    content.fromEmail = fromEmail;
    content.cc = cc;
    content.bcc = bcc;
  }

  if ('attachments' in req.body) {
    content.attachments = attachments;
    content.extension = extension;
  }

  const clientID = req.headers['x-client-id'];

  const notificationRecord = await creatingNotificationRecord(
    clientID,
    service,
    destination,
    content,
  );
  if (notificationRecord.statusCode) {
    return res.status(notificationRecord.statusCode).json({
      error: notificationRecord.message,
      messageId: notificationRecord.messageId,
    });
  }

  const { url, fields } = await generatePreSignedUrl(
    clientID,
    notificationRecord.messageId,
  );

  let result;

  if (!attachments) {
    notificationRecord.clientId = clientID;
    result = await publishingNotificationRequest(notificationRecord);
  }

  const response = attachments
    ? {
        success: true,
        message: `Waiting for file upload on URL (expiry 5 mins). Message Id: ${notificationRecord.messageId}`,
        url: url,
        fields: fields,
      }
    : {
        success: true,
        message: `Notification request accepted ${result ? 'and queued.' : ''}`,
        messageId: notificationRecord.messageId, // Return the ID to the client
      };

  return res.status(202).json(response);
};

const notifyWithEmailAttachment = async (req, res) => {
  try {
    const { media } = req.body;
    if (!media) {
      throw new Error('Please send media (S3 URL)');
    }

    const headers = req.headers;
    console.log("Req from aws lambda", headers);

    const parts = media.split('/');
    const fileName = parts.slice(-2).join('/');
    const messageId = parts.pop();

    const clientID = req.headers['x-client-id'];

    const notificationData = await getNotificationData(messageId, clientID);
    let content = {
      subject: notificationData.subject,
      body: notificationData.body,
      fromEmail: notificationData.fromEmail,
      media: media,
      extension: notificationData.extension,
      attachments: notificationData.attachments
    };

    if (notificationData.cc) {
      content.cc = notificationData.cc;
    }

    if (notificationData.bcc) {
      content.bcc = notificationData.bcc;
    }

    const service = notificationData.service;
    const destination = notificationData.destination;

    const path = await downloadS3File(
      media,
      fileName,
      notificationData.extension,
    );

    const notificationRecord = await creatingNotificationRecord(
      clientID,
      service,
      destination,
      content,
    );
    if (notificationRecord.statusCode) {
      return res.status(notificationRecord.statusCode).json({
        error: notificationRecord.message,
        messageId: notificationRecord.messageId,
      });
    }

    notificationRecord.clientId = clientID;
    notificationRecord.fileId = messageId;
    result = await publishingNotificationRequest(notificationRecord);

    return res.status(202).json({
      status: 'accepted',
      message: `Notification request accepted ${result ? 'and queued.' : ''}`,
      messageId: notificationRecord.messageId, // Return the ID to the client
    });
  } catch (err) {
    console.log('Error in notifying with email attachement', err.message);
    if (err.message === 'Please send media (S3 URL)') {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    if (err.message === 'No message found with this MessageID') {
      return res.status(404).json({
        success: false,
        message: err.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
};

module.exports = { notify, notifyWithEmailAttachment };

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
