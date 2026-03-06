const { serializeLogs } = require('./serialization');
const Sequelize = require('sequelize');

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

const viewMessageLogs = async (
  idClient,
  service,
  status,
  page,
  limit,
  order,
  sort,
  message,
  destination,
  attempts,
  cc,
  bcc,
  fromEmail,
  from,
  to,
) => {
    const offset = (page - 1) * limit;
    const where = {};
    let sortOrder = [];

    let dbConnect = await global.connectionManager.getModels(idClient);
    const validColumns = Object.keys(dbConnect.Notification.rawAttributes);

    if(from && to) {
      if(new Date(to) < new Date(from)) {
        throw { statusCode: 400, message: `From can't be greater than To`};
      }
    }

    if (sort && order && (order === 'asc' || order === 'desc')) {
      const keys = sort.split(',');
      for (let i = 0; i < keys.length; i++) {
        if (validColumns.includes(keys[i])) {
          sortOrder.push([keys[i], order]);
        } else if (keys[i] === 'message') {
          sortOrder.push(['connectorResponse', order.toUpperCase()]);
        }
      }
    }
   
    if (from){
      const startDay = new Date(from);
      startDay.setHours(0,0,0,0) 
      where.updatedAt = {
        [Sequelize.Op.gte] : startDay
      }
    }
    

    if (to) {
      const endDay = new Date(to);
      endDay.setHours(0,0,0,0);
      where.updatedAt[Sequelize.Op.lt] = endDay;
    }

    if (attempts) {
      where.attempts = +attempts;
    }

    const filters = [
      { key: 'connectorResponse', value: message, pattern: (v) => `%${v}%` },
      { key: 'destination', value: destination, pattern: (v) => `%${v}%` },
      { key: 'content.cc', value: cc, pattern: (v) => `%${v}%` },
      { key: 'content.bcc', value: bcc, pattern: (v) => `%${v}%` },
      { key: 'content.fromEmail', value: fromEmail, pattern: (v) => `%${v}%` },
      { key: 'service', value: service, pattern: (v) => `%${v}%` },
      { key: 'status', value: status, pattern: (v) => `%${v}%` },
    ];

    filters.forEach(({ key, value, pattern }) => {
      if (!value) return;

      where[key] = {
        [Sequelize.Op.iLike]: pattern(value),
      };
    });

    const { count, rows } = await dbConnect.Notification.findAndCountAll({
      where,
      order:
        sortOrder.length === 0
          ? [['createdAt', order.toUpperCase()]]
          : sortOrder,
      offset,
      limit,
    });

    const totalPages = Math.ceil(count / limit);

    const data = serializeLogs(rows);
    return { data, totalPages };
};

module.exports = { viewDeliveryStatus, viewMessageLogs };
