'use strict';
const { LRUCache } = require('lru-cache');
const { loadClientConfigs } = require('../loadClientConfigs.js');
const logger = require('../../logger.js');
const SmsSender = require('../smsSender.js');

class SMSManager {
    constructor() {
        this.smsCache = new LRUCache({
            max: 50,
            ttl: 1000 * 60 * 60, // 1 hour
            dispose: (value, key) => {
                console.log(`Evicting sms service for client ${key} from cache`);
            },
        });
    }

    async initializeSMSSender(smsConfig, clientId) {
        if (this.smsCache.get(clientId)) return;

        if (!smsConfig) {
            const clientList = await loadClientConfigs();
            smsConfig = clientList.find(client => client.ID === clientId)?.SMS;
            if (!smsConfig) {
                logger.info(`[${clientId}] SMS configuration not found`);
                return;
            }
        }

        logger.info(`[${clientId}] Testing SMS service connection...`);
        const smsSender = new SmsSender(smsConfig);
        await smsSender.initialize();
        logger.info(`[${clientId}] SMS service connection successful.`);
        this.smsCache.set(clientId, smsSender);
    }

    async getSMSSender(clientId) {
        let smsSender = this.smsCache.get(clientId);
        if (!smsSender) {
            await this.initializeSMSSender(undefined, clientId);
            smsSender = this.smsCache.get(clientId);
        }
        return smsSender;
    }

    async close(clientId) {
        const smsSender = this.smsCache.get(clientId);
        if (smsSender) {
            this.smsCache.delete(clientId); // No close method assumed; add if available
        }
    }

    async closeAll() {
        this.smsCache.clear(); // No close method assumed; add if available
    }

    clearCache(clientId) {
        if (clientId) this.smsCache.delete(clientId);
        else this.smsCache.clear();
    }
}
module.exports=new SMSManager();