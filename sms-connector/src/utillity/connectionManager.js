const DatabaseManager = require("./manager/database");
const RabbitMQManager = require("./manager/rabbit");
const SMSManager = require("./manager/sms");

class ConnectionManager {
    constructor() {
     
    }
    async initialize(clientConfig,clientId) {
        let RABBITMQ = {};
        if (clientConfig?.SMS?.RABBITMQ) {
            RABBITMQ = { ...clientConfig.SMS.RABBITMQ };
        }
        if (clientConfig.RABBITMQ) {
            RABBITMQ = { ...RABBITMQ, ...clientConfig.RABBITMQ };
        }
        await DatabaseManager.initializeSequelize(clientConfig?.DBCONFIG, clientId);
        await RabbitMQManager.initializeRABBITMQ(RABBITMQ, clientId);
        await SMSManager.initializeSMSSender(clientConfig?.SMS, clientId);
    }
    async getModels(clientId) {
        return await this.dbManager.getModels(clientId);
    }

    async getRabbitMQ(clientId) {
        return await this.rabbitManager.getRabbitMQ(clientId);
    }

    async getSMSSender(clientId) {
        return await this.smsManager.getSMSSender(clientId);
    }

    async closeAllTypeConnection(clientId) {
        await this.dbManager.close(clientId);
        await this.rabbitManager.close(clientId);
        await this.smsManager.close(clientId);
    }

    async closeAll() {
        await this.dbManager.closeAll();
        await this.rabbitManager.closeAll();
        await this.smsManager.closeAll();
    }

    clearCache(clientId) {
        this.dbManager.clearCache(clientId);
        this.rabbitManager.clearCache(clientId);
        this.smsManager.clearCache(clientId);
    }
}

module.exports = new ConnectionManager();