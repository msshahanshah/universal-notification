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

const { validPublicURL } = require('../../helpers/regex.helper');
const { fromNumber, templateId } = require('../validators/whatsapp.validator');
const { generatePreSignedUrl } = require("../../helpers/preSignedUrl.helper");
const logger = require("../logger");

const notify = async (req, res) => {
  try {
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
      templateId,
      fromNumber,
      contentVariables,
    } = req.body;

    const clientID = req.headers['x-client-id'];

    // Build content
    let content = message
      ? { message, attachments, templateId, fromNumber, contentVariables }
      : { subject, body, fromEmail, cc, bcc, attachments };

    if (contentVariables) {
      content = {
        message,
        attachments,
        templateId,
        fromNumber,
        contentVariables,
      };
    }

    const notificationRecords = await creatingNotificationRecord(
      clientID,
      service,
      destination,
      content,
    );

    logger.info(
      `Notification record created successfully | client: ${clientID} | service: ${service}`,
    );
    for (const record of notificationRecords) {
      if (record.statusCode) {
        return res.status(record.statusCode).json({
          error: record.message,
          messageId: record.messageId,
        });
      }
      record.clientId = clientID;
    }

    let preSignedUrls;
    if (
      attachments?.length &&
      typeof attachments[0] === 'string' &&
      !validPublicURL(attachments[0])
    ) {
      preSignedUrls = await generatePreSignedUrl(
        clientID,
        notificationRecords[0].messageId,
        attachments,
      );
      logger.info(
        `preSigned URLs generated successfully for message request: ${notificationRecords[0].messageId}`,
      );
    }

    let publishResults;
    if (
      !attachments ||
      attachments?.length === 0 ||
      typeof attachments[0] === 'object' ||
      validPublicURL(attachments[0])
    ) {
      publishResults = await Promise.all(
        notificationRecords.map(async (record) => {
          try {
            const result = await publishingNotificationRequest(record);
            logger.info(
              `Notification record published successfully |  client: ${clientID} | service: ${service} | messageId: ${record.messageId}`,
            );
            return result;
          } catch (err) {
            return { success: false, record, error: err.message };
          }
        }),
      );
    }

    const response = {
      success: true,
      status: 'accepted',
      message:
        attachments?.length &&
        typeof attachments[0] === 'string' &&
        !validPublicURL(attachments[0])
          ? 'Waiting for file upload on URL (expiry 5 mins).'
          : `Notification request accepted ${
              publishResults ? 'and queued.' : ''
            }`,
      preSignedUrls,
    };

    if (notificationRecords?.length === 1) {
      response.messageId = notificationRecords[0].messageId;
    } else {
      response.messageIds = notificationRecords.map((r) => r.messageId);
    }
    return res.status(202).json(response);
  } catch (error) {
    logger.error({
      message: error.message,
      stack: error?.stack,
    });
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

const notifyWithEmailAttachment = async (req, res) => {
  try {
    const { attachments, messageId } = req.body;
    if (
      !attachments ||
      !Array.isArray(attachments) ||
      attachments.length === 0
    ) {
      throw {
        statusCode: 400,
        message:
          "Attachments are required. Please provide at least one S3 URL.",
      };
    }

    const clientId = req.headers["x-client-id"];

    const notificationData = await getNotificationData(messageId, clientId);
    let content = {
      subject: notificationData.subject,
      body: notificationData.body,
      fromEmail: notificationData.fromEmail,
      attachments,
      fromNumber: notificationData.fromNumber,
      message: notificationData.message,
      templateId: notificationData.templateId,
    };

    logger.info(`Notification Data fetched successfully for ${messageId}`);

    if (notificationData.cc) {
      content.cc = notificationData.cc;
    }

    if (notificationData.bcc) {
      content.bcc = notificationData.bcc;
    }

    const service = notificationData.service;
    const destination = notificationData.destination;

    const notificationRecord = {
      service,
      destination,
      content,
      clientId,
      messageId,
      attachments,
    };

    const result = await publishingNotificationRequest(notificationRecord);

    logger.info(
      `Notification record with attachment publish successfully | client ${clientId} | messageId ${messageId}`,
    );

    return res.status(202).json({
      success: true,
      status: 'accepted',
      message: `Notification request accepted ${result ? 'and queued.' : ''}`,
      messageId, // Return the ID to the client
    });
  } catch (err) {
    logger.error({
      message: err.message,
      stack: err?.stack,
    });
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};

module.exports = { notify, notifyWithEmailAttachment };
