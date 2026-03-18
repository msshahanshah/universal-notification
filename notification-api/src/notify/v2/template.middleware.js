const { getTemplateText } = require("../../../helpers/s3-template");
const logger = require("../../logger");
const RedisHelper = require("../../../helpers/redis.helper")

const verifyVariables = (variableValues, requiredVariables) => {
    if (!requiredVariables || !requiredVariables.length) return;
    if (!variableValues) {
        throw {
            statusCode: 400,
            message: "Variable values are required when the template has defined variables."
        };
    }

    const expectedVars = requiredVariables.map(v => v.name);
    const providedVars = Object.keys(variableValues);

    const allMatched =
        providedVars.every(v => expectedVars.includes(v)) &&
        expectedVars.every(v => providedVars.includes(v));

    if (!allMatched) {
        throw {
            statusCode: 400,
            message: "Provided variables do not match the required variables for this template."
        };
    }
}

const verifyConstraints = (variableValues, requiredVariables) => {
    if (!requiredVariables || !requiredVariables.length) return;

    for (const variable of requiredVariables) {
        const value = variableValues[variable.name];
        const constraints = variable.constraints;
        if (!constraints) continue;

        if (constraints.maxlength && String(value).length > parseInt(constraints.maxlength)) {
            throw {
                statusCode: 400,
                message: `Variable '${variable.name}' exceeds the maximum length of ${constraints.maxlength} characters.`
            };
        }

        if (constraints.dataType === "number" && isNaN(Number(value))) {
            throw {
                statusCode: 400,
                message: `Variable '${variable.name}' must be a valid number.`
            };
        }

        if (constraints.dataType === "integer" && !Number.isInteger(Number(value))) {
            throw {
                statusCode: 400,
                message: `Variable '${variable.name}' must be a valid integer.`
            };
        }
    }
}

const replaceVariables = (messageContent, variableValues) => {
    let content = messageContent;
    for (const [key, value] of Object.entries(variableValues)) {
        content = content.replaceAll(`{{${key}}}`, value);
    }
    return content;
}

const templateMiddleware = async (req, res, next) => {
    try {
        const body = req.body;
        const clientId = req.headers["x-client-id"];
        const dbConnect = await global.connectionManager.getModels(clientId);
        for (const [service, messages] of Object.entries(body)) {
            for (let msg of messages) {
                if (!msg.templateId) {
                    continue;
                }

                if (!msg.variableValues) {
                    throw {
                        statusCode: 400,
                        message: `Variable values are required for template '${msg.templateId}'.`
                    }
                }

                const templateKey = `${service}:${msg.templateId}`;
                let template = await RedisHelper.getValue(templateKey);

                if (template) {
                    template = JSON.parse(template);
                }

                if (!template) {
                    template = await dbConnect.Template.findOne({
                        where: { templateId: msg.templateId, service },
                        raw: true
                    });

                    if (!template) {
                        throw {
                            statusCode: 404,
                            message: `Template '${msg.templateId}' for service '${service}' was not found.`
                        };
                    }

                    if (service === "email") {
                        template.messageContent = await getTemplateText(template.messageContent);
                    }

                    await RedisHelper.setKey(templateKey, JSON.stringify(template), "template");
                }

                verifyVariables(msg.variableValues, template.requiredFields);
                verifyConstraints(msg.variableValues, template.requiredFields);

                if (service === "email") {
                    msg.body = replaceVariables(template.messageContent, msg.variableValues);
                }
                else {
                    msg.message = replaceVariables(template.messageContent, msg.variableValues);
                }
            }
        }
        next();
    } catch (error) {
        logger.error({
            message: error.message || "Template processing error",
            stack: error?.stack,
            clientId: req.headers["x-client-id"]
        });
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Internal server error during template processing"
        });
    }
}

module.exports = templateMiddleware;