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
                HOST: process.env.DB_HOST || 'localhost',
                PORT: parseInt(process.env.DB_PORT || '5432', 10),
                NAME: process.env.DB_NAME || 'notifications_db',
                USER: process.env.DB_USER || 'postgres',
                PASSWORD: process.env.DB_PASSWORD || '',
            },
            RABBITMQ: {
                HOST: process.env.RABBITMQ_HOST || 'localhost',
                PORT: parseInt(process.env.RABBITMQ_PORT || '5672', 10),
                USER: process.env.RABBITMQ_USER || 'guest',
                PASSWORD: process.env.RABBITMQ_PASSWORD || '',
            },
            EMAIL: {
                HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
                PORT: parseInt(process.env.SMTP_PORT || '587', 10),
                USER: process.env.SMTP_USER || ''
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