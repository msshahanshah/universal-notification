const logger = require('./logger');
const connectionManager = require('./utillity/connectionManager');

async function connectAndConsume(clientConfigList) {
  try {
    await Promise.all(
      clientConfigList.map(async (clientItem) => {
        await connectionManager.initializeSequelize(
          clientItem.DBCONFIG,
          clientItem.ID,
        );
        await connectionManager.initializeEmailSender(
          clientItem.EMAIL,
          clientItem.ID,
        );
        // Get RabbitMQ client from package manager
        const rabbitClient = await connectionManager.getRabbitMQ(clientItem.ID);

        // Get database for this client
        const db = await connectionManager.getModels(clientItem.ID);

        // Create SMS sender function
        const emailSender = await connectionManager.getEmailSender(
          clientItem.ID,
        );

        // Start consuming with package consumer
        await rabbitClient.consume({
          service: 'email',
          sender: (payload, messageId) => {
            if (process.env.NODE_ENV === 'testing') {
              db.Notification.update(
                { status: 'sent' },
                { where: { messageId } },
              );
            }
            return emailSender.sendEmail(payload);
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
