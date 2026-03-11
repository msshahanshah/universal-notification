const logger = require("../logger")
const { registerTemplate, getTemplates } = require("./service")
const validateTemplate = require("../../helpers/htmlValidation")

const createTemplate = async (req, res, next) => {
    try {
        const clientId = req.headers["x-client-id"];
        const { messageContent } = req.body;

        validateTemplate(messageContent);

        const result = await registerTemplate(clientId, req.body);

        return res.status(200).json({
            success: true,
            message: "Template created successfully",
            data: result
        })

    } catch (error) {
        logger.error({
            message: error.message,
            stack: error?.stack
        })

        return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
}

const viewTemplates = async (req, res, next) => {
    try {
        const clientId = req.headers["x-client-id"];

        const result = await getTemplates(clientId);

        return res.status(200).json({
            success: true,
            messsage: "Templates fetch successfully",
            data: result
        })
    } catch (error) {
        logger.error({
            message: error.message,
            stack: error?.stack
        })

        return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
}
module.exports = {
    createTemplate,
    viewTemplates
}