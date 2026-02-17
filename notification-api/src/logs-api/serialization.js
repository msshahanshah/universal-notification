const { fromEmail } = require('../validators/email.validator');

const serializeLogs = (rows) => {
  return rows.map((log) => {
    let ccEmail = log.content.cc?.length ? log.content.cc[0] : null;
    let bccEmail = log.content.bcc?.length ? log.content.bcc[0] : null;
    let fromEmail = log.content.fromEmail?.length
      ? log.content.fromEmail[0]
      : null;
    const response = {
      id: log.id,
      messageId: log.messageId,
      service: log.service,
      destination: log.destination,
      status: log.status,
      attempts: log.attempts,
      messageDate: log.createdAt,
      message: log.status === 'failed' ? log.connectorResponse : '',
      attempts: log.attempts,
    };
    if (fromEmail) response.fromEmail = fromEmail;
    if (ccEmail) response.cc = ccEmail;
    if (bccEmail) response.bcc = bccEmail;
    return response;
  });
};

module.exports = { serializeLogs };
