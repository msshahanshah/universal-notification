const { error } = require("winston");
const { off } = require("../app");
const { serializeLogs } = require("./serialization");

const viewDeliveryStatus = async (messageId, clientId) => {
    let dbConnect = await global.connectionManager.getModels(clientId);
    const data = await dbConnect.Notification.findOne({
        where: { messageId }
    })

    if (!data) {
        throw new Error("Message not found")
    }

    return {
        messageId: data.messageId,
        status: data.status
    }
}

const viewMessageLogs = async (idClient, service, status, page, limit) => {
    const offset = (page - 1) * limit;
    const where = {};
    if (service) {
        where.service = service; // filter based on service
    }
    if (status) {
        where.status = status
    }

    if (!idClient) {
        throw new Error('Not authorized');
    }

    let dbConnect = await global.connectionManager.getModels(idClient);
    const { count, rows } = await dbConnect.Notification.findAndCountAll({
        where,
        offset,
        limit
    });
    const totalPages = Math.ceil(count / limit);

    const data = serializeLogs(rows);
    return { data, totalPages };

}

module.exports = { viewDeliveryStatus, viewMessageLogs };
