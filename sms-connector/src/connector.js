const logger = require('./logger');
const connectionManager = require('./utillity/connectionManager');

async function connectAndConsume(clientConfigList) {
    try {
        await Promise.all(clientConfigList.map(async (clientItem) => {
            if (!clientItem) {
                logger.error('Client configuration is undefined or null.');
                return;
            }
            if (!clientItem.ID) {
                logger.error('Client ID is missing in the configuration.');
                return;
            }
            if (!clientItem.SERVER_PORT) {
                logger.error(`Server port is missing for client ${clientItem.ID}.`);
                return;
            }
            await connectionManager.initialize(clientItem, clientItem.ID);
            global.connectionManager = connectionManager;
            await connectionManager.initializeRABBITMQ(clientItem, clientItem.ID);
            global.connectionManager = connectionManager;
        }));
        logger.info('All connections initialized successfully.');
    } catch (error) {
        logger.error('Failed to connect or consume from RabbitMQ / DB check failed:', { error: error.message, stack: error.stack });
        await closeConnections(true);
        logger.info(`Retrying connection in ${retryDelay / 1000} seconds... (Attempt ${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay)); // Wait before retrying
    }
}
async function closeConnections(clientId) {
    try {
        if (clientId) {
            await connectionManager.closeAllTypeConnection(clientId);
            logger.info(`Closed all connections for client ${clientId}`);
        } else {
            await connectionManager.closeAll();
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
