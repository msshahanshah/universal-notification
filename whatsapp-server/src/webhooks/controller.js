const logger = require('../logger');
const { updateWhatsAppMessageStatus } = require('./service');

const whatsAppController = async (req, res) => {
    try {
        const { MessageStatus: status, SmsSid: referenceId } = req.body;
        const clientId = req.query.id;
        const provider = req.query.provider;
        await updateWhatsAppMessageStatus(status, referenceId, clientId, provider);
        logger.info(`[${clientId}] Status of whatsapp message update successfully to ${status}`);
        res.status(201).json({
            message: "Status updated successfully",
            success: true
        });
    } catch (err) {
        logger.error('Status of whatsapp msg not updated successfully', { message: err.message });
        return res.status(500).json({
            message: err.message,
            success: false
        })
    }
}

module.exports = { whatsAppController }