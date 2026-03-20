const logger = require('./logger');
const { consumeNotification } = require('./services/webhook.service');
const connectionManager = require('./utils/connectionManager');

async function connectAndConsume(clientConfigList) {
  try {
    await Promise.all(
      clientConfigList.map(async (clientItem) => {
        // Get RabbitMQ client from package manager
        const rabbitClient = await connectionManager.getRabbitMQ(clientItem.ID);

        // Start consuming with package consumer
        await rabbitClient.consume({
          service: 'webhook',
          sender: consumeNotification,
          db: null,
          maxProcessAttemptCount: 3,
        });
      }),
    );
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
