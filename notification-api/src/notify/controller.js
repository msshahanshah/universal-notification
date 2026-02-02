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
const { downloadS3File } = require("../../helpers/fileOperation.helper");

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
    content.attachments = attachments;
  }

  const clientID = req.headers["x-client-id"];

  const notificationRecords = await creatingNotificationRecord(
    clientID,
    service,
    destination,
    content,
  );
  if (notificationRecords.statusCode) {
    return res.status(notificationRecords.statusCode).json({
      error: notificationRecords.message,
      messageId: notificationRecords.messageId,
    });
  }

  let preSignedUrls;
  if (attachments?.length && typeof attachments[0] === "string") {
    preSignedUrls = await generatePreSignedUrl(
      clientID,
      notificationRecords.messageId,
      attachments,
    );
  }

  let result;
  if (
    !attachments ||
    (attachments?.length && typeof attachments[0] === "object") ||
    attachments?.length === 0
  ) {
    notificationRecords.clientId = clientID;
    result = await publishingNotificationRequest(notificationRecords);
  }

  const response =
    attachments?.length > 0 && typeof attachments[0] === "string"
      ? {
          success: true,
          message: `Waiting for file upload on URL (expiry 5 mins). Message Id: ${notificationRecords.messageId}`,
          preSignedUrls,
        }
      : {
          success: true,
          message: `Notification request accepted ${result ? "and queued." : ""}`,
          messageId: notificationRecords.messageId, // Return the ID to the client
        };

  // return res.status(202).json(response);
  // console.log(notificationRecordss);
  notificationRecords.forEach((notificationRecord) => {
    if (notificationRecord.statusCode) {
      return res.status(notificationRecord.statusCode).json({
        error: notificationRecord.message,
        messageId: notificationRecord.messageId,
      });
    } else {
      notificationRecord.clientId = clientID;
    }
  });

  const publishResults = await Promise.all(
    notificationRecords.map(async (record) => {
      try {
        return await publishingNotificationRequest(record);
      } catch (err) {
        return { success: false, record, error: err.message };
      }
    }),
  );

  return res.status(202).json({
    success: true,
    status: "accepted",
    message: `Notification request accepted ${publishResults ? "and queued." : ""}`,
    messageId: notificationRecords.messageId, // Return the ID to the client
  });
};

const notifyWithEmailAttachment = async (req, res) => {
  try {
    const { attachments, messageId } = req.body;
    if (
      !attachments ||
      (!Array.isArray(attachments) && attachments.length === 0)
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
