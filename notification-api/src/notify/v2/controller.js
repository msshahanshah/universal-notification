const logger = require("../../logger");
const { notifyService: notifyV2Service } = require("./service");
const notify = async (req, res) => {
  const failed = [];
  const success = [];

  const clientId = req.headers["x-client-id"];
  const body = req.body;
  const data = {}; // response data
  let isSuccess = false;
  let isFailed = false;

  for (const [service, messages] of Object.entries(body)) {
    const bulkMessages = [];
    for (const msg of messages) {
      const {
        destination,
        message: textMessage,
        subject,
        body,
        fromEmail,
        cc,
        bcc,
        attachments,
        templateId,
        uniqueKey,
      } = msg;

      const content = textMessage
        ? { message: textMessage, uniqueKey }
        : { subject, body, fromEmail, cc, bcc, attachments, uniqueKey };

      // insert into bulk
      bulkMessages.push({
        service,
        destination,
        content,
        attachments,
        uniqueKey,
      });
    }

    try {
      const notificationRecord = await notifyV2Service(
        clientId,
        service,
        bulkMessages,
      );

      // prepare success response
      let successRecord = {
        service,
        messageIds: notificationRecord.messages?.map(
          (record) => record.messageId,
        ),
      };

      if (notificationRecord.preSignedUrls) {
        successRecord.preSignedUrls = notificationRecord.preSignedUrls;
      }

      // insert success response
      data[successRecord.service] = {
        success: true,
        messageIds: successRecord.messageIds,
        message: "Notification request accepted and queued.",
      };

      // update isSuccess flag
      isSuccess = true;
    } catch (error) {
      logger.error("ERROR: In creating notify record: v2", error);
      data[error.service] = {
        success: false,
        statusCode: error?.statusCode,
        message: error?.message,
      };
      // update isfailed flag
      isFailed = true;
    }
  }

  // prepare statusCode
  const statusCode = isFailed && isSuccess ? 207 : isSuccess ? 200 : 400;
  return res.status(statusCode).json({
    data,
  });
};

module.exports = {
  notify,
};
