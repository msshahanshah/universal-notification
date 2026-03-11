const logger = require("../logger");
const createRoutingRule = require("./service");

const createRouting = async (req, res, next) => {
    try {
        const clientId = req.headers["x-client-id"];
        const { service, provider, matchKey, matchValue } = req.body;

        if (!service || !provider || !matchKey || !matchValue) {
            return res.status(400).json({
                success: false,
                message: "Provide the required fields"
            })
        }

        const result = await createRoutingRule(clientId, { service, provider, matchKey, matchValue });

        return res.status(200).json({
            success: true,
            message: "Routing rule added successfully",
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

module.exports = createRouting;