const logger = require("../logger");
const path = require('path');
const fs = require('fs').promises;
/**
 * Loads client configurations from clientList.json and merges with defaults from .env.
 * @returns {Promise<Array<Object>>} - Array of client configurations.
 */
async function loadClientConfigs() {
    try {
        const clientListPath = path.join(__dirname, '../../../clientList.json');
        const clientData = await fs.readFile(clientListPath, 'utf-8');
        const clients = JSON.parse(clientData);

        // Default configurations from .env
        const defaultConfig = {
            DBCONFIG: {
                HOST: process.env.POSTGRES_HOST || 'localhost',
                PORT: process.env.POSTGRES_PORT || 5432,
                NAME: process.env.POSTGRES_DB || 'notifications_db',
                USER: process.env.POSTGRES_USER || 'postgres',
                PASSWORD: process.env.POSTGRES_PASSWORD || 'admin',
            },
            RABBITMQ: {
                HOST:'localhost',
                PORT:5672,
                USER:'user',
                PASSWORD:'password',
            },
        };

        // Merge client configs with defaults
        return clients.map(client => ({
            ID: client.ID,
            SERVER_PORT: client.SERVER_PORT || 3000,
            ENABLED_SERVERICES:client.ENABLED_SERVERICES || [],
            DBCONFIG: client.DBCONFIG || defaultConfig.DBCONFIG,
            SMS: client.SMS || defaultConfig.SMS,
            RABBITMQ:{
                ...client.RABBITMQ,
                SERVERICES:client.SMS.RABBITMQ
            } || defaultConfig.RABBITMQ,
        }));
    } catch (error) {
        logger.error('Failed to load client configurations:', { error: error.message });
        throw error;
    }
}

module.exports = {
    loadClientConfigs,
};