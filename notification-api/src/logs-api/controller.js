const viewDeliveryStatus = require("./service");

const deliveryStatus = async (req, res, next) => {
    try {
        const messageId = req.params.id;
        const clientId = req.header('X-Client-Id');

        const result = await viewDeliveryStatus(messageId, clientId);

        res.status(200).json({
            status: "success",
            message: "Data fetch successfully",
            data: result
        })
    } catch (error) {
        if (error.parent?.code === "22P02") {
            return res.status(400).json({ error: "Message id is not valid" })
        }
        if (error.message === "Message not found") {
            return res.status(404).json({ error: error.message });
        }

        return res.status(500).json({ error: error.message });
    }
}

module.exports = deliveryStatus;