const rabbitManager = require("../src/utillity/rabbit");
const { StatusCodes } = require("http-status-codes");

const publishMessageInRabbitMQ = async (payload) => {
  try {
    const { serviceName, isWebhookAllowed, clientId } = payload;
    const rabbitConnect = await rabbitManager.getClient(clientId);

    if (!rabbitConnect) {
      throw {
        statusCode: StatusCodes.SERVICE_UNAVAILABLE,
        message: "Rabbit Connection failed",
      };
    }

    let updatedServiceName = serviceName;
    if (serviceName.toLowerCase() === "slack") {
      updatedServiceName = "slackbot";
    }

    return rabbitConnect.publishMessage(updatedServiceName, {
      isWebhookAllowed,
      clientId,
    });
  } catch (err) {
    throw err;
  }
};

module.exports = { publishMessageInRabbitMQ };
