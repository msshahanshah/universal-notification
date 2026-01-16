const { error } = require("winston");

const viewDeliveryStatus = async (messageId, clientId) => {
    let dbConnect = await global.connectionManager.getModels(clientId);
    const data = await dbConnect.Notification.findOne({
        where: { messageId }
    })

    if (!data){
        throw new Error("Message not found")
    }

    return {
        messageId: data.messageId,
        status: data.status
    }
}
module.exports = viewDeliveryStatus;
