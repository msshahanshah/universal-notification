const DatabaseManager = require("./manager/database");
const RabbitMQManager = require("./manager/rabbit");
const SMSManager = require("./manager/sms");

class ConnectionManager {
    constructor() {
     
    }
    async initialize(clientConfig,clientId) {
        await DatabaseManager.initializeSequelize(clientConfig?.DBCONFIG, clientId);
        await SMSManager.initializeSMSSender(clientConfig?.SMS, clientId);
    }
    async initializeRABBITMQ(clientConfig, clientId) {
        let RABBITMQ = {};
        if (clientConfig?.SMS?.RABBITMQ) {
            RABBITMQ = { ...clientConfig.SMS.RABBITMQ };
        }
        if (clientConfig.RABBITMQ) {
            RABBITMQ = { ...RABBITMQ, ...clientConfig.RABBITMQ };
        }
        await RabbitMQManager.initializeRABBITMQ(RABBITMQ, clientId);
    }
    async getModels(clientId) {
        return await DatabaseManager.getModels(clientId);
    }

    async getRabbitMQ(clientId) {
        return await RabbitMQManager.getRabbitMQ(clientId);
    }

    async getSMSSender(clientId) {
        return await SMSManager.getSMSSender(clientId);
    }

    async closeAllTypeConnection(clientId) {
        await DatabaseManager.close(clientId);
        await RabbitMQManager.close(clientId);
        await SMSManager.close(clientId);
    }

    async closeAll() {
        await DatabaseManager.closeAll();
        await RabbitMQManager.closeAll();
        await SMSManager.closeAll();
    }

    clearCache(clientId) {
        DatabaseManager.clearCache(clientId);
        RabbitMQManager.clearCache(clientId);
        SMSManager.clearCache(clientId);
    }
}

module.exports = new ConnectionManager();