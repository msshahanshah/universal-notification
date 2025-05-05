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
                HOST: config.dbHost || 'localhost',
                PORT: config.dbPort || 5432,
                NAME: config.dbName || 'notifications_db',
                USER: config.dbUser || 'postgres',
                PASSWORD: config.dbPassword || 'admin',
            },
            RABBITMQ: {
                HOST: config.rabbitMQHost || 'localhost',
                PORT: config.rabbitMQPort || 5672,
                USER: config.rabbitMQUser || 'user',
                PASSWORD: config.rabbitMQPassword || 'password',
            },
        };

        // Merge client configs with defaults
        return clients.map(client => ({
            ID: client.ID,
            SERVER_PORT: client.SERVER_PORT || 3000,
            SLACKBOT_TOKEN: client.SLACKBOT_TOKEN || '',
            DBCONFIG: client.DBCONFIG || defaultConfig.DBCONFIG,
            RABBITMQ: client.RABBITMQ || defaultConfig.RABBITMQ,
        }));
    } catch (error) {
        logger.error('Failed to load client configurations:', { error: error.message });
        throw error;
    }
}

module.exports = {
    loadClientConfigs,
};