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

  const urls = await generatePreSignedUrl(
    clientID,
    notificationRecord.messageId,
    attachments,
  );

  let result;

  if (attachments.length === 0) {
    notificationRecord.clientId = clientID;
    result = await publishingNotificationRequest(notificationRecord);
  }

  const response =
    attachments.length > 0
      ? {
          success: true,
          message: `Waiting for file upload on URL (expiry 5 mins). Message Id: ${notificationRecord.messageId}`,
          urls,
        }
      : {
          success: true,
          message: `Notification request accepted ${result ? "and queued." : ""}`,
          messageId: notificationRecord.messageId, // Return the ID to the client
        };

  return res.status(202).json(response);
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

    const clientID = req.headers["x-client-id"];

    const notificationData = await getNotificationData(messageId, clientID);
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

    await Promise.all(
      attachments?.map((file) => {
        // <s3_prefix>/uploads/<CLIENT_ID>/<MESSAGE_ID>?<size>/<file_name>
        const s3Url = file;
        const parts = file.split("/");
        const filename = file.split("/uploads/")[1];
        return downloadS3File(s3Url, filename, messageId);
      }),
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
      status: "accepted",
      message: `Notification request accepted ${result ? "and queued." : ""}`,
      messageId: notificationRecord.messageId, // Return the ID to the client
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
