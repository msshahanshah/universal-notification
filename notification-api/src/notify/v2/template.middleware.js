const { getTemplateText } = require("../../../helpers/s3-template");
const logger = require("../../logger");
const RedisHelper = require("../../../helpers/redis.helper");

const verifyVariables = (
  variableValues,
  requiredVariables,
  templateId,
  service,
) => {
  if (!requiredVariables || !requiredVariables.length) return;
  if (!variableValues) {
    throw {
      service,
      statusCode: 400,
      message:
        "Variable values are required when the template has defined variables.",
    };
  }

  const expectedVars = requiredVariables.map((v) => v.name);
  const providedVars = Object.keys(variableValues);

  const allMatched =
    providedVars.every((v) => expectedVars.includes(v)) &&
    expectedVars.every((v) => providedVars.includes(v));

  if (!allMatched) {
    throw {
      service,
      statusCode: 400,
      message: `Provided variables do not match the required variables for ${templateId} template.`,
    };
  }
};

const verifyConstraints = (variableValues, requiredVariables, service) => {
  if (!requiredVariables || !requiredVariables.length) return;

  for (const variable of requiredVariables) {
    const value = variableValues[variable.name];
    const constraints = variable.constraints;
    if (!constraints) continue;

    if (
      constraints.maxlength &&
      String(value).length > parseInt(constraints.maxlength)
    ) {
      throw {
        service,
        statusCode: 400,
        message: `Variable '${variable.name}' exceeds the maximum length of ${constraints.maxlength} characters.`,
      };
    }

    if (constraints.dataType === "number" && isNaN(Number(value))) {
      throw {
        service,
        statusCode: 400,
        message: `Variable '${variable.name}' must be a valid number.`,
      };
    }

    if (
      constraints.dataType === "integer" &&
      !Number.isInteger(Number(value))
    ) {
      throw {
        service,
        statusCode: 400,
        message: `Variable '${variable.name}' must be a valid integer.`,
      };
    }
  }
};

const replaceVariables = (messageContent, variableValues) => {
  let content = messageContent;
  for (const [key, value] of Object.entries(variableValues)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  return content;
};

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

        // TODO
        // if (!msg.variableValues) {
        //     throw {
        //         service,
        //         statusCode: 400,
        //         message: `Variable values are required for template '${msg.templateId}'.`
        //     }
        // }

        const templateKey = `${service}:${msg.templateId}`;
        let template = await RedisHelper.getValue(templateKey);

        if (template) {
          template = JSON.parse(template);
        }

        if (!template) {
          template = await dbConnect.Template.findOne({
            where: { templateId: msg.templateId, service },
            raw: true,
          });

          if (!template) {
            throw {
              service,
              statusCode: 404,
              message: `Template '${msg.templateId}' was not found.`,
            };
          }

          if (service === "email") {
            template.messageContent = await getTemplateText(
              template.messageContent,
            );
          }

          if (template.requiredFields && !msg.variableValues) {
            throw {
              service,
              statusCode: 400,
              message: `Variable values are required for template '${msg.templateId}'.`,
            };
          }

          await RedisHelper.setKey(
            templateKey,
            JSON.stringify(template),
            "template",
          );
        }

        verifyVariables(
          msg.variableValues,
          template.requiredFields,
          msg.templateId,
          service,
        );
        verifyConstraints(msg.variableValues, template.requiredFields, service);

        if (service === "email") {
          msg.body = replaceVariables(
            template.messageContent,
            msg.variableValues,
          );
        } else {
          msg.message = replaceVariables(
            template.messageContent,
            msg.variableValues,
          );
        }
      }
    }
    next();
  } catch (error) {
    logger.error({
      message: error.message || "Template processing error",
      stack: error?.stack,
      service: error?.service,
      clientId: req.headers["x-client-id"],
    });
    return res.status(error.statusCode || 500).json({
      data: {
        [error?.service || "internal"]: {
          success: false,
          statusCode: error.statusCode,
          message: error.message,
        },
      },
    });
  }
};

module.exports = templateMiddleware;
