const logger = require("../logger");
const { createRoutingRule, removeRoutingRule, getRoutingRules, updateRoutingRule } = require("./service");

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

const removeRouting = async (req, res, next) => {
    try {
        const { ruleId } = req.params;
        const parsedRuleId = Number(ruleId);

        if (!Number.isInteger(parsedRuleId) || parsedRuleId <= 0) {
            throw {
                statusCode: 400,
                message: "Rule Id should be a positive integer"
            };
        }
        const clientId = req.headers["x-client-id"];

        await removeRoutingRule(clientId, parsedRuleId);
        return res.status(200).json({
            success: true,
            message: "Routing rule deleted successfully"
        })
    } catch (error) {
        logger.error({
            message: error.message,
            stack: error?.stack
        })
        return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
}

const viewRouting = async (req, res, next) => {
    try {
        const clientId = req.headers["x-client-id"];

        const result = await getRoutingRules(clientId, req.query);

        return res.status(200).json({
            success: true,
            message: "Data fetch successfully",
            data: result.rows,
            pagination: {
                total: result.total,
                currentPage: result.currentPage,
                totalPages: result.totalPages
            }
        });
    } catch (error) {
        logger.error({
            message: error.message,
            stack: error?.stack
        })
        return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
}

const updateRouting = async (req, res, next) => {
    try {
        const clientId = req.headers["x-client-id"];
        const { ruleId } = req.params;
        const result = await updateRoutingRule(clientId, ruleId, req.body);

        return res.status(200).json({
            success: true,
            message: "Data updated successfully",
            data: result
        });
    } catch (error) {
        logger.error({
            message: error.message,
            stack: error?.stack
        })
        return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
}

module.exports = { createRouting, removeRouting, viewRouting, updateRouting };
