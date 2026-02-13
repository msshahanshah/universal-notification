const serializeLogs = (rows) => {
  return rows.map((log) => {
    return {
      id: log.id,
      messageId: log.messageId,
      service: log.service,
      destination: log.destination,
      status: log.status,
      attempts: log.attempts,
      messageDate: log.createdAt,
    };
  });
};

module.exports = { serializeLogs };
