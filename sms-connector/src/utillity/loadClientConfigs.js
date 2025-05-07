const logger = require("../logger");
const fs = require('fs').promises;
const path = require('path');
/**
 * Loads client configurations from clientList.json and merges with defaults.
 * @returns {Promise<Array<Object>>} - Array of client configurations.
 */
async function loadClientConfigs() {
    try {
        const clientListPath = path.join(__dirname, '../../../clientList.json');
        const clientData = await fs.readFile(clientListPath, 'utf-8');
        const clients = JSON.parse(clientData);

        const defaultConfig = {
            DBCONFIG: {
                HOST: 'localhost',
                PORT: 5432,
                NAME:'notifications_db',
                USER: 'postgres',
                PASSWORD:'admin',
            },
            RABBITMQ: {
                HOST:'localhost',
                PORT:5672,
                USER: 'user',
                PASSWORD: 'password',
            },
            EMAIL: {
                HOST: 'smtp.gmail.com',
                PORT: 587,
                USER: 'userName'
            }
        };

        return clients.map(client => ({
            ID: client.ID,
            SERVER_PORT: client.SERVER_PORT || 3000,
            DBCONFIG: client.DBCONFIG || defaultConfig.DBCONFIG,
            RABBITMQ: client.RABBITMQ || defaultConfig.RABBITMQ,
            EMAIL: client.EMAIL || defaultConfig.EMAIL,
        }));
    } catch (error) {
        logger.error('Failed to load client configurations:', { error: error.message });
        throw error;
    }
}

module.exports = {
    loadClientConfigs,
};