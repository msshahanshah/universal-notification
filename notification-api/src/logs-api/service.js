const { serializeLogs } = require('./serialization');

const viewDeliveryStatus = async (messageId, clientId) => {
  let dbConnect = await global.connectionManager.getModels(clientId);
  const data = await dbConnect.Notification.findOne({
    where: { messageId },
  });

  if (!data) {
    throw new Error('Message not found');
  }

  return {
    messageId: data.messageId,
    status: data.status,
  };
};

const viewMessageLogs = async (idClient, service, status, page, limit) => {
  try {
    const offset = (page - 1) * limit;
    const where = {};
    if (service) {
      where.service = service;
    }
    if (status) {
      where.status = status;
    }

    if (!idClient) {
      throw new Error('Not authorized');
    }

    let dbConnect = await global.connectionManager.getModels(idClient);

    const { count, rows } = await dbConnect.Notification.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      offset,
      limit,
    });

    const totalPages = Math.ceil(count / limit);

    const data = serializeLogs(rows);
    return { data, totalPages };
  } catch (error) {
    console.log(error);
  }
};

module.exports = { viewDeliveryStatus, viewMessageLogs };
