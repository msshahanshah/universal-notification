'use strict';
const { LRUCache } = require('lru-cache');
const { loadClientConfigs } = require('../loadClientConfigs.js');
const logger = require('../../logger.js');
class RabbitMQManager {
    constructor() {
        this.rabbitCache = new LRUCache({
            max: 50,
            ttl: 1000 * 60 * 60, // 1 hour
            dispose: (value, key) => {
                console.log(`Evicting RabbitMQ connection for client ${key} from cache`);
            },
        });
    }

    async initializeRABBITMQ(rabbitConfig, clientId) {
        if (this.rabbitCache.get(clientId)) return;

        if (!rabbitConfig) {
            const clientList = await loadClientConfigs();
            rabbitConfig = clientList.find(client => client.ID === clientId)?.RABBITMQ;
            if (!rabbitConfig) throw new Error(`RabbitMQ configuration not found for client ID: ${clientId}`);
        }

        const RABBITMQ_URL = rabbitConfig.HOST && rabbitConfig.PORT && rabbitConfig.USER && rabbitConfig.PASSWORD
            ? `amqp://${rabbitConfig.USER}:${rabbitConfig.PASSWORD}@${rabbitConfig.HOST}:${rabbitConfig.PORT}`
            : 'amqp://user:password@rabbitmq:5672';

        const rabbit = await require('../../rabbitMQClient.js')(RABBITMQ_URL, rabbitConfig);
        logger.info(`[${clientId}] Testing RabbitMQ connection...`);
        await rabbit.connectRabbitMQ();
        logger.info(`[${clientId}] RabbitMQ connection successful.`);
        this.rabbitCache.set(clientId, rabbit);
        // set here clientId + provider as a key
    }

    async getRabbitMQ(clientId) {
        let rabbit = this.rabbitCache.get(clientId);
        if (!rabbit) {
            await this.initializeRABBITMQ(undefined, clientId);
            rabbit = this.rabbitCache.get(clientId);
        }
        return rabbit;
    }

    async close(clientId) {
        const rabbit = this.rabbitCache.get(clientId);
        if (rabbit) {
            await rabbit.closeConnection();
            this.rabbitCache.delete(clientId);
        }
    }

    async closeAll() {
        for (const [clientId, rabbit] of this.rabbitCache) {
            await rabbit.closeConnection();
        }
        this.rabbitCache.clear();
    }

    clearCache(clientId) {
        if (clientId) this.rabbitCache.delete(clientId);
        else this.rabbitCache.clear();
    }
}
module.exports=new RabbitMQManager();