const logger = require('../logger');
const { updateSmsStatus } = require('./service');

const webhookController = async (req, res) => {
    try {
        const { SmsStatus: status, SmsSid: referenceId } = req.body;
        console.log(req.body)
        const clientId = req.query.id;
        const provider = req.query.provider;
        console.log("request received")
        await updateSmsStatus(status, referenceId, clientId, provider);
        logger.info(`[${clientId}] Status of "sms" update successfully to ${status}`);
        res.status(201).json({
            message: "Status updated successfully",
            success: true
        });
    } catch (err) {
        logger.error('Status of "sms" msg not updated successfully', { message: err.message });
        return res.status(500).json({
            message: err.message,
            success: false
        })
    }
}

module.exports = { webhookController }