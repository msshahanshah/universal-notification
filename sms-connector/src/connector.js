const logger = require("./logger");
const connectionManager = require("./utillity/connectionManager");

async function connectAndConsume(clientConfigList) {
  try {
    await Promise.all(
      clientConfigList.map(async (clientItem) => {
        if (!clientItem) {
          logger.error("Client configuration is undefined or null.");
          return;
        }
        if (!clientItem.ID) {
          logger.error("Client ID is missing in the configuration.");
          return;
        }
        if (!clientItem.SERVER_PORT) {
          logger.error(`Server port is missing for client ${clientItem.ID}.`);
          return;
        }
        // Initialize DB and SMS
        await connectionManager.initialize(clientItem, clientItem.ID);

        // Get RabbitMQ client from package manager
        const rabbitClient = await connectionManager.getRabbitMQ(clientItem.ID);

        // Get database for this client
        const db = await connectionManager.getModels(clientItem.ID);

        // Start consuming with package consumer
        await rabbitClient.consume({
          service: "sms",
          sender: async (payload, messageId) => {
            if (process.env.NODE_ENV === "testing") {
              const message = await db.Notification.findOne({
                where: { messageId }
              });
              if (!message) {
                logger.error("Message Not Found")
                return;
              }
              await db.Notification.update(
                { status: "sent" },
                { where: { messageId } }
              )
            }
            const { to, message, provider } = payload;
            const fn = await connectionManager.getSMSSender(
              clientItem.ID,
              provider,
            );
            await fn.sendSms({ to, message });
          },
          db,
          maxProcessAttemptCount: 3,
        });
      }),
    );

    // Make connectionManager available globally for rabbitMQClient
    global.connectionManager = connectionManager;
    logger.info("All connections initialized successfully.");
  } catch (error) {
    logger.error(
      "Failed to connect or consume from RabbitMQ / DB check failed:",
      { error: error.message, stack: error.stack },
    );
    throw error; // Re-throw to let caller handle
  }
}
async function closeConnections(clientId) {
  try {
    if (clientId) {
      await connectionManager.closeAllTypeConnection(clientId);
      logger.info(`Closed all connections for client ${clientId}`);
    } else {
      await connectionManager.closeAll();
      logger.info("Closed all connections");
    }
  } catch (error) {
    logger.error("Failed to close connections:", { error: error.message });
  }
}
module.exports = {
  connectAndConsume,
  closeConnections,
};
