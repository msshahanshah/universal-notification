const logger = require("./logger");
const connectionManager = require("./utillity/connectionManager");

async function connectAndConsume(clientConfigList) {
  try {
    await Promise.all(
      clientConfigList.map(async (clientItem) => {
        connectionManager.initializeSequelize(
          clientItem.DBCONFIG,
          clientItem.ID,
        );
        await connectionManager.initializeEmailSender(
          clientItem.EMAIL,
          clientItem.ID,
        );
        // Get RabbitMQ client from package manager
        const rabbitClient = await connectionManager.getRabbitMQ(clientItem.ID);
        console.log(rabbitClient);
        // Get database for this client
        const db = await connectionManager.getModels(clientItem.ID);

        // Create SMS sender function
        const emailSender = await connectionManager.getEmailSender(
          clientItem.ID,
        );

        // Start consuming with package consumer
        await rabbitClient.consume({
          service: "email",
          sender: async (payload, messageId) => {
            // destructor payload
            const { content, destination, provider } = payload;
            const msgData = {
              to: destination,
              subject: content.subject,
              html: content.body,
              from: content.fromEmail,
              cc: content.cc,
              bcc: content.bcc,
              attachments: content.attachments,
              provider: provider,
            };
            if (process.env.NODE_ENV === "testing") {
              const msg = await db.Notification.findOne({
                where: { messageId },
              });
              if (!msg) {
                logger.error(`Message not found for id: {messageId}`);
                return;
              }
              await db.Notification.update(
                { status: "sent" },
                { where: { messageId } },
              );
            }

            try {
              const res = await emailSender.sendEmail(messageId, msgData);
              if (content.isWebhookEnabled) {
                logger.info(
                  `Webhook message published for email with id: ${messageId}`,
                );
                await rabbitClient.publishMessage("webhook", {
                  clientId: clientItem.ID,
                  service: "email",
                  status: "sent",
                  messageId,
                  details: {
                    connectorResponse: res,
                  },
                });
              }
            } catch (error) {
              if (content.isWebhookEnabled) {
                logger.info(
                  `Webhook message published for email with id: ${messageId}`,
                );
                await rabbitClient.publishMessage("webhook", {
                  clientId: clientItem.ID,
                  service: "email",
                  status: "failed",
                  details: {
                    messageId,
                    connectorResponse: res,
                  },
                });

                throw error;
              }
            }
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
      { message: error.message, stack: error?.stack },
    );
    throw error; // Re-throw to let caller handle retry logic
  }
}

async function closeConnections(clientId) {
  try {
    if (clientId) {
      await connectionManager.closeAllTypeConnection(clientId);
      logger.info(`Closed all connections for client ${clientId}`);
    } else {
      await connectionManager.close();
      logger.info("Closed all connections");
    }
  } catch (error) {
    logger.error("Failed to close connections:", {
      message: error.message,
      stack: error?.stack,
    });
  }
}
module.exports = {
  connectAndConsume,
  closeConnections,
};
