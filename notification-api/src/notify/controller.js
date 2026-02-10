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
} = require("./service");

const { generatePreSignedUrl } = require("../../helpers/preSignedUrl.helper");

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
    } = req.body;

    const clientID = req.headers["x-client-id"];

    // Build content
    const content = message
      ? { message }
      : { subject, body, fromEmail, cc, bcc, attachments };

    const notificationRecords = await creatingNotificationRecord(
      clientID,
      service,
      destination,
      content,
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
    if (attachments?.length && typeof attachments[0] === "string") {
      preSignedUrls = await generatePreSignedUrl(
        clientID,
        notificationRecords[0].messageId,
        attachments,
      );
    }

    let publishResults;
    if (
      !attachments ||
      attachments?.length === 0 ||
      typeof attachments[0] === "object"
    ) {
      publishResults = await Promise.all(
        notificationRecords.map(async (record) => {
          try {
            return await publishingNotificationRequest(record);
          } catch (err) {
            return { success: false, record, error: err.message };
          }
        }),
      );
    }

    const response = {
      success: true,
      status: "accepted",
      message:
        attachments?.length && typeof attachments[0] === "string"
          ? "Waiting for file upload on URL (expiry 5 mins)."
          : `Notification request accepted ${
              publishResults ? "and queued." : ""
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
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
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
      throw new Error("Please send media (S3 URL's)");
    }

    const headers = req.headers;

    const clientId = req.headers["x-client-id"];

    const notificationData = await getNotificationData(messageId, clientId);
    let content = {
      subject: notificationData.subject,
      body: notificationData.body,
      fromEmail: notificationData.fromEmail,
      attachments,
    };

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

    result = await publishingNotificationRequest(notificationRecord);

    return res.status(202).json({
      success: true,
      status: "accepted",
      message: `Notification request accepted ${result ? "and queued." : ""}`,
      messageId, // Return the ID to the client
    });
  } catch (err) {
    console.log("Error in notifying with email attachement", err.message);
    if (err.message === "Please send media (S3 URL)") {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    if (err.message === "No message found with this MessageID") {
      return res.status(404).json({
        success: false,
        message: err.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

module.exports = { notify, notifyWithEmailAttachment };
