const logger = require('./logger');
const connectionManager = require('./utillity/connectionManager');

async function connectAndConsume(clientConfigList) {
    try {
        for (const clientItem of clientConfigList) {
           await connectionManager.initializeSequelize(clientItem.DBCONFIG, clientItem.ID);
           await connectionManager.initializeRABBITMQ({...clientItem.RABBITMQ,...clientItem.EMAIL.RABBITMQ},clientItem.ID);
           await connectionManager.initializeEmailSender(clientItem.EMAIL, clientItem.ID);
        }
        global.connectionManager = connectionManager;  
      
        logger.info('All connections initialized successfully.');
    } catch (error) {
        logger.error('Failed to connect or consume from RabbitMQ / DB check failed:', { error: error.message, stack: error.stack });
        await closeConnections(true);
        logger.info(`Retrying connection in ${retryDelay / 1000} seconds... (Attempt ${retryCount}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay)); // Wait before retrying
    }
}
module.exports = {
    connectAndConsume
};
