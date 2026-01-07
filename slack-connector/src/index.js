const cluster = require('cluster');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const config = require('./config'); // Environment variables or default configs
const { connectAndConsume, closeConnections } = require('./connector');

/**
 * Loads client configurations from clientList.json and merges with defaults.
 * @returns {Promise<Array<Object>>} - Array of client configurations.
 */
async function loadClientConfigs() {
    try {
        const clientListPath = path.join(__dirname, '../../clientList.json');
        const clientData = await fs.readFile(clientListPath, 'utf-8');
        const clients = JSON.parse(clientData);

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
            SLACKBOT: {
                TOKEN: config.slackBotToken || '',
                RABBITMQ: {
                    EXCHANGE_NAME: config.rabbitMQExchangeName || 'notifications',
                    EXCHANGE_TYPE: config.rabbitMQExchangeType || 'direct',
                    QUEUE_NAME: config.rabbitMQQueueName || 'slack',
                    ROUTING_KEY: config.rabbitMQBindingKey || 'slack',
                },
            },
        };

        return clients.map(client => ({
            ID: client.ID,
            SERVER_PORT: client.SERVER_PORT || 3000,
            DBCONFIG: client.DBCONFIG || defaultConfig.DBCONFIG,
            RABBITMQ: client.RABBITMQ || defaultConfig.RABBITMQ,
            SLACKBOT: {
                TOKEN: client.SLACKBOT?.TOKEN || defaultConfig.SLACKBOT.TOKEN,
                RABBITMQ: client.SLACKBOT?.RABBITMQ || defaultConfig.SLACKBOT.RABBITMQ,
            },
        }));
    } catch (error) {
        logger.error('Failed to load client configurations:', { error: error.message });
        throw error;
    }
}
// Master and Worker Logic
if (cluster.isMaster) {
    (async () => {
        try {
            let clients = await loadClientConfigs();
            logger.info(`Master: Loaded ${clients.length} clients.`);

            // Map to track worker data for restarts
            const workerDataMap = new Map();

            clients.forEach(client => {
                const RABBITMQ_URL = `amqp://${client.RABBITMQ.USER}:${client.RABBITMQ.PASSWORD}@${client.RABBITMQ.HOST}:${client.RABBITMQ.PORT}`;
                const worker = cluster.fork({ CLIENT_ID: client.ID, RABBITMQ_URL });
                workerDataMap.set(worker.id, { clientId: client.ID, rabbitMQUrl: RABBITMQ_URL });
                logger.info(`Master: Forked worker for client ${client.ID} (PID: ${worker.process.pid})`);
            });

            cluster.on('exit', (worker, code, signal) => {
                logger.warn(`Master: Worker ${worker.process.pid} exited with code ${code} (signal: ${signal})`);
                const workerData = workerDataMap.get(worker.id);
                if (workerData) {
                    const { clientId, rabbitMQUrl } = workerData;
                    logger.info(`Master: Restarting worker for client ${clientId}...`);
                    const newWorker = cluster.fork({ CLIENT_ID: clientId, RABBITMQ_URL: rabbitMQUrl });
                    workerDataMap.set(newWorker.id, workerData);
                    workerDataMap.delete(worker.id);
                } else {
                    logger.error('Master: Unable to restart worker - missing worker data');
                }
            });
        } catch (error) {
            logger.error('Master: Failed to initialize:', { error: error.message });
            process.exit(1);
        }
    })();
} else {
    (async () => {
        try {
            let clients = await loadClientConfigs();
            const clientId = process.env.CLIENT_ID;
            const client = clients.find(c => c.ID === clientId);

            if (!client) {
                logger.error(`Worker: No configuration found for client ${clientId}`);
                process.exit(1);
            }

            await connectAndConsume(client);

            process.on('SIGTERM', () => closeConnections(clientId));
            process.on('SIGINT', () => closeConnections(clientId));
            process.on('unhandledRejection', (reason, promise) => {
                logger.error(`[${clientId}] Unhandled Rejection at:`, { promise, reason: reason.message || reason });
                closeConnections(clientId).then(() => process.exit(1));
            });
            process.on('uncaughtException', (error) => {
                logger.error(`[${clientId}] Uncaught Exception:`, { error: error.message, stack: error.stack });
                closeConnections(clientId).then(() => process.exit(1));
            });
        } catch (error) {
            logger.error(`Worker: Failed to start for client ${process.env.CLIENT_ID}:`, { error: error.message });
            process.exit(1);
        }
    })();
}