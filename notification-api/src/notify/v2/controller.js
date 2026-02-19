const { notifyService: notifyV2Service } = require("./service");
const notify = async (req, res) => {
  const failed = [];
  const success = [];

  const clientId = req.headers["x-client-id"];
  const body = req.body;
  for (const [service, messages] of Object.entries(body)) {
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
      } = msg;

      const content = textMessage
        ? { message: textMessage }
        : { subject, body, fromEmail, cc, bcc, attachments };

      // insert into bulk
      bulkMessages.push({
        service,
        destination,
        content,
        attachments,
      });
    }
    const notificationRecords = await notifyV2Service(
      clientId,
      service,
      bulkMessages,
    );
    success.push(notificationRecords);
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

// console.log("sdfhe", messages);
// for (const msg of messages) {
//   const {
//     destination,
//     message: textMessage,
//     subject,
//     body,
//     fromEmail,
//     cc,
//     bcc,
//     attachments,
//     service,
//   } = msg;

//   const content = textMessage
//     ? { message: textMessage }
//     : { subject, body, fromEmail, cc, bcc, attachments };

//   try {
//     const { notificationRecords, preSignedUrls, publishResults } =
//       await notifyV2Service(
//         clientID,
//         service,
//         destination,
//         content,
//         attachments,
//       );

//     success.push({
//       service,
//       status: "accepted",
//       messageId: notificationRecords.map((r) => r.messageId),
//       preSignedUrls,
//     });
//   } catch (error) {
//     failed.push({
//       message: error.message || "internal server error",
//     });
//   }
// }

// const statusCode =
//   failed.length && success.length ? 207 : success.length ? 200 : 400;

// return res.status(statusCode).json({
//   data: { failed, success },
// });
