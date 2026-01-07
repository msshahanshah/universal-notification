const logger = require('./logger');
const connectionManager = require('./utillity/connectionManager');

async function connectAndConsume(clientConfigList) {
    try {
        await Promise.all(clientConfigList.map(async (clientItem) => {
            await connectionManager.initializeSequelize(clientItem.DBCONFIG, clientItem.ID);
            await connectionManager.initializeEmailSender(clientItem.EMAIL, clientItem.ID);
            await connectionManager.initializeRABBITMQ({ ...clientItem.RABBITMQ, ...clientItem.EMAIL.RABBITMQ }, clientItem.ID);
        }));

        // Make connectionManager available globally for rabbitMQClient
        global.connectionManager = connectionManager;

        logger.info('All connections initialized successfully.');
    } catch (error) {
        logger.error('Failed to connect or consume from RabbitMQ / DB check failed:', { error: error.message, stack: error.stack });
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
    closeConnections
};
