const { serializeLogs } = require("./serialization");
const Sequelize = require("sequelize");
const { SERVICES, LOG_TYPE } = require("../../constants/index");
const viewDeliveryStatus = async (messageId, clientId) => {
  let dbConnect = await global.connectionManager.getModels(clientId);
  const data = await dbConnect.Notification.findOne({
    where: { messageId },
  });

  if (!data) {
    throw new Error("Message not found");
  }

  return {
    messageId: data.messageId,
    status: data.status,
  };
};

const viewMessageLogs = async (
  idClient,
  logType,
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
  fromDate,
  toDate,
) => {
  try {
    const offset = (page - 1) * limit;
    const where = {};
    let sortOrder = [];

    let dbConnect = await global.connectionManager.getModels(idClient);
    const validColumns = Object.keys(dbConnect.Notification.rawAttributes);

    if(fromDate && toDate) {
      if(new Date(toDate) < new Date(fromDate)) {
        throw { statusCode: 400, message: `from-date can't be greater than to-date`};
      }
    }

    if (sort && order && (order === "asc" || order === "desc")) {
      const keys = sort.split(",");
      for (let i = 0; i < keys.length; i++) {
        if (validColumns.includes(keys[i])) {
          sortOrder.push([keys[i], order]);
        } else if (keys[i] === "message") {
          sortOrder.push(["connectorResponse", order.toUpperCase()]);
        }
      }
    }
   
    if (fromDate){
      const startDay = new Date(fromDate);
      startDay.setHours(0,0,0,0) 
      where.updatedAt = {
        [Sequelize.Op.gte] : startDay
      }
    }
    

    if (toDate) {
      const endDay = new Date(toDate);
      endDay.setHours(0,0,0,0);
      where.updatedAt[Sequelize.Op.lt] = endDay;
    }

    if (attempts) {
      where.attempts = +attempts;
    }

    const filters = [
      { key: "connectorResponse", value: message, pattern: (v) => `%${v}%` },
      { key: "destination", value: destination, pattern: (v) => `%${v}%` },
      { key: "content.cc", value: cc, pattern: (v) => `%${v}%` },
      { key: "content.bcc", value: bcc, pattern: (v) => `%${v}%` },
      { key: "content.fromEmail", value: fromEmail, pattern: (v) => `%${v}%` },
      { key: "service", value: service, pattern: (v) => `%${v}%` },
      { key: "status", value: status, pattern: (v) => `%${v}%` },
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
          ? [["createdAt", order.toUpperCase()]]
          : sortOrder,
      offset,
      limit,
    });

    const totalPages = Math.ceil(count / limit);

    const data = serializeLogs(rows);
    let finalData = [];

    //===============Getting all replyed messages of slack=============

    //check do we need to send slack replyed messages or not

    if (logType === LOG_TYPE.SLACK_LOGS && data.length > 0) {
      const referenceIds = data.map((row) => row.referenceId); //getting parent id of all messages on which replyed

      const service = SERVICES.SLACK_SERVICE;

      //find all replyed messages
      const replyedMessages = await dbConnect.SlackReplyMessage.findAll({
        where: {
          parentReferenceId: referenceIds,
          service,
        },
        attributes: ["parentReferenceId", "userReferenceName", "content"],
      });

      // to store userRepledMessages taking map
      const userReplyedMessagesMap = {};

      // iterating each messsages and add reactions username and messages replyed by users
      replyedMessages.forEach((item) => {
        const content = item.content;
        const parentId = item.parentReferenceId;

        if (!userReplyedMessagesMap[parentId]) {
          userReplyedMessagesMap[parentId] = [];
        }

        userReplyedMessagesMap[parentId].push({
          username: item.userReferenceName,
          reactions: content.reaction,
          message: content.message,
        });
      });

      //  adding messages replyed by users
      finalData = data.map((item) => ({
        ...item,
        useReplyedMessages: userReplyedMessagesMap[item.referenceId] || [],
      }));
    }

    return { data: finalData.length > 0 ? finalData : data, totalPages };
  } catch (err) {
    throw err;
  }
};

module.exports = { viewDeliveryStatus, viewMessageLogs };
