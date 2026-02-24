const { notifyService: notifyV2Service } = require("./service");
const notify = async (req, res) => {
  const failed = [];
  const success = [];

  const clientId = req.headers["x-client-id"];
  const body = req.body;
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
        messageIds: notificationRecord.messages?.map((record) => {
          if (record.preSignedUrls) {
            preSignedUrls.push(...r.preSignedUrls?.preSignedUrls);
          }
          return record.messageId;
        }),
      };

      if (notificationRecord.preSignedUrls) {
        successRecord.preSignedUrls = notificationRecord.preSignedUrls;
      }

      // insert success response
      success.push(successRecord);
    } catch (error) {
      console.log("error", error);
      failed.push(error);
    }
  }

  // send response
  const statusCode =
    failed.length && success.length ? 207 : success.length ? 200 : 400;

  return res.status(statusCode).json({
    data: { failed, success },
  });
};

module.exports = {
  notify,
};
