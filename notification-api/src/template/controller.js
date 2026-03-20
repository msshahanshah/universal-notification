const logger = require("../logger")
const { registerTemplate, getTemplates, removeTemplate, modifyService } = require("./service")

const createTemplate = async (req, res, next) => {
    try {
        const clientId = req.headers["x-client-id"];

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
        const result = await getTemplates(clientId, req.query);

        return res.status(200).json({
            success: true,
            message: "Templates fetch successfully",
            data: result.templates,
            pagination: {
                total: result.total,
                currentPage: result.currentPage,
                totalPages: result.totalPages
            }
        })
    } catch (error) {
        logger.error({
            message: error.message,
            stack: error?.stack
        })

        return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
}

const deleteTemplate = async (req, res, next) => {
    try {
        const clientId = req.headers["x-client-id"];
        const { id } = req.params;

        await removeTemplate(clientId, id);

        return res.status(200).json({
            success: true,
            message: "Template deleted successfully"
        })
    } catch (error) {
        logger.error({
            message: error.message,
            stack: error?.stack
        })

        return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
}

const updateTemplate = async (req, res, next) => {
    try {
        const clientId = req.headers["x-client-id"];
        const { id } = req.params;

        const result = await modifyService(clientId, id, req.body);

        return res.status(200).json({
            success: true,
            message: "Template updated successfully",
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
    viewTemplates,
    deleteTemplate,
    updateTemplate
}