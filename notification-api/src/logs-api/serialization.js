const serializeLogs = (rows) => {
  return rows.map((log) => {
    const value = log.createdAt.toLocaleString('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
    });
    const [date, time] = value.split(', ').map((v) => v.trim());
    return {
      id: log.id,
      messageId: log.messageId,
      service: log.service,
      destination: log.destination,
      message: log.content?.message || null,
      status: log.status,
      attempts: log.attempts,
      messageDate: log.createdAt
    };
  });
};

module.exports = { serializeLogs };
