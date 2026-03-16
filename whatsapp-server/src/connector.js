const logger = require('./logger');
const connectionManager = require('./utility/connectionManager');

async function connectAndConsume(clientConfigList) {
  try {
    await Promise.all(
      clientConfigList.map(async (clientItem) => {
        await connectionManager.initializeSequelize(
          clientItem.DBCONFIG,
          clientItem.ID,
        );
        await connectionManager.initializeWhatsAppSender(
          clientItem.EMAIL,
          clientItem.ID,
        );
        // Get RabbitMQ client from package manager
        const rabbitClient = await connectionManager.getRabbitMQ(clientItem.ID);

        // Get database for this client
        const db = await connectionManager.getModels(clientItem.ID);

        // Create WhatsApp sender function
        const whatsAppSender = await connectionManager.getWhatsAppSender(
          clientItem.ID,
        );

        // Start consuming with package consumer
        await rabbitClient.consume({
          service: 'whatsapp',
          sender: async (payload, messageId) => {
            const { destination, content, provider } = payload;
            const {
              fromNumber,
              templateId,
              attachments = [],
              message,
              contentVariables,
            } = content;

            const msgData = {
              fromNumber,
              templateId,
              attachments,
              message,
              destination,
              contentVariables,
            };

            if (process.env.NODE_ENV === 'testing') {
              const msg = await db.Notification.findOne({
                where: { messageId },
              });
              if (!msg) {
                logger.error(`Message not found for id: {messageId}`);
                return;
              }
              await db.Notification.update(
                { status: 'sent' },
                { where: { messageId } },
              );

              return;
            }
            if (!attachments.length) {
              return whatsAppSender.sendWhatsAppMessage(msgData, messageId);
            }
            const result = await Promise.all(
              msgData.attachments?.map((attachment) => {
                return whatsAppSender.sendWhatsAppMessage(
                  {
                    fromNumber,
                    templateId,
                    attachment,
                    message,
                    destination,
                    contentVariables,
                  },
                  messageId,
                );
              }),
            );
            return result.length === 1 ? result[0] : result;
          },
          db,
          maxProcessAttemptCount: 3,
        });
      }),
    );

    // Make connectionManager available globally for rabbitMQClient
    global.connectionManager = connectionManager;

    logger.info('All connections initialized successfully.');
  } catch (error) {
    logger.error(
      'Failed to connect or consume from RabbitMQ / DB check failed:',
      { error: error.message, stack: error.stack },
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
      logger.info('Closed all connections');
    }
  } catch (error) {
    logger.error('Failed to close connections:', { error: error.message });
  }
}
module.exports = {
  connectAndConsume,
  closeConnections,
};
