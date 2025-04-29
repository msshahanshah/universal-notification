const cluster = require('cluster');
const fs = require('fs').promises;
const path = require('path');
const express = require('express');
const httpProxy = require('http-proxy');
const config = require('./config');
const { connectRabbitMQ, closeConnection: closeRabbitMQConnection } = require('./rabbitMQClient');
const logger = require('./logger');
const { Sequelize } = require('sequelize');

/**
 * @type {import('http').Server|null}
 */
let server;
let masterServer;
/**
 * Loads client configurations from clientList.json and merges with defaults from .env.
 * @returns {Promise<Array<Object>>} - Array of client configurations.
 */
async function loadClientConfigs() {
    try {
        const clientListPath = path.join(__dirname, '../../clientList.json');
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

/**
 * Initializes Sequelize instance for a client.
 * @param {Object} dbConfig - Database configuration.
 * @param {string} clientId - Client identifier.
 * @returns {Sequelize} - Sequelize instance.
 */
function initializeSequelize(dbConfig, clientId) {
    return new Sequelize({
        dialect: 'postgres', // Adjust if using another database
        host: dbConfig.HOST,
        port: dbConfig.PORT,
        database: dbConfig.NAME,
        username: dbConfig.USER,
        password: dbConfig.PASSWORD,
        logging: msg => logger.debug(`[${clientId}] Sequelize: ${msg}`),
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000,
        },
    });
}

/**
 * Starts the server for a specific client.
 * @param {Object} client - Client configuration.
 * @returns {Promise<void>}
 */
async function startServer(client) {
    const clientId = client.ID;
    logger.info(`[${clientId}] Starting server...`);
    console.log("client", client.SERVER_PORT)
    try {
        // Initialize client-specific Sequelize
        logger.info(`[${clientId}] Testing database connection...`);
        const sequelize = initializeSequelize(client.DBCONFIG, clientId);
        await sequelize.authenticate();
        logger.info(`[${clientId}] Database connection successful.`);

        // Store sequelize instance for shutdown
        global.clientSequelize = sequelize;
        global.rabbitMQ=client.RABBITMQ; 
        // Connect to RabbitMQ
        logger.info(`[${clientId}] Connecting to RabbitMQ...`);
        await connectRabbitMQ(); // connectRabbitMQ accepts config
        logger.info(`[${clientId}] RabbitMQ connection established successfully.`);
        const app = require('./app');
        // Start HTTP Server
        server = app.listen(client.SERVER_PORT, () => {
            logger.info(`[${clientId}] Notification API listening on port ${client.SERVER_PORT} in ${config.env} mode`);
        });

    } catch (error) {
        logger.error(`[${clientId}] Failed to start server:`, { error: error.message, stack: error.stack });
        await shutdown(1, clientId);
    }
}

/**
 * Shuts down the server for a specific client.
 * @param {number} [exitCode=0] - Exit code.
 * @param {string} [clientId='unknown'] - Client identifier.
 * @returns {Promise<void>}
 */
async function shutdown(exitCode = 0, clientId = 'unknown') {
    logger.info(`[${clientId}] Shutting down server...`);

    // Close HTTP server
    if (server) {
        await new Promise((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    logger.error(`[${clientId}] Error closing HTTP server:`, err);
                    return reject(err);
                }
                logger.info(`[${clientId}] HTTP server closed.`);
                resolve();
            });
            setTimeout(() => reject(new Error('HTTP server close timeout')), 10000).unref();
        }).catch(err => logger.error(`[${clientId}] ${err.message}`));
        server = null;
    }

    // Close RabbitMQ connection
    await closeRabbitMQConnection().catch(err => logger.error(`[${clientId}] Error closing RabbitMQ connection:`, err));

    // Close Database connection
    if (global.clientSequelize) {
        await global.clientSequelize.close().then(() => {
            logger.info(`[${clientId}] Database connection closed.`);
        }).catch(err => logger.error(`[${clientId}] Error closing database connection:`, err));
        global.clientSequelize = null;
    }

    logger.info(`[${clientId}] Shutdown complete. Exiting with code ${exitCode}.`);
    process.exit(exitCode);
}

// Global clients array for port calculation
let clients = [];

// Master process: Fork workers for each client
if (cluster.isMaster) {
    (async () => {
        try {
            clients = await loadClientConfigs();
            logger.info(`Master: Loaded ${clients.length} clients.`);

            // Start master router
            try{
                const proxy = httpProxy.createProxyServer({});
            
                const masterApp = express();
             
                masterApp.use((req, res, next) => {
                    const clientId = req.headers['x-client-id'];
                    const client = clients.find(c => c.ID === clientId);
                    if (!client) {
                        logger.warn('Invalid or missing X-Client-Id header', { clientId });
                        return res.status(400).json({ error: 'Invalid or missing X-Client-Id header' });
                    }
                    
                    logger.info(`Routing request for client ${clientId} to port ${client.SERVER_PORT}`);
                    proxy.web(req, res, { target: `http://localhost:${client.SERVER_PORT}` }, (err) => {
                        logger.error('Proxy error', { error: err.message });
                        res.status(500).json({ error: 'Failed to route request' });
                    });
                });
    
                masterServer = masterApp.listen(3010, () => {
                    logger.info('Master router listening on port 3000');
                });
            }catch (error) {
                console.log("error", error)
            }
            
            

            // Fork a worker for each client
            clients.forEach(client => {
                let RABBITMQ_URL='amqp://user:password@rabbitmq:5672'
                if(client.RABBITMQ&&client.RABBITMQ.HOST&&client.RABBITMQ.PORT&&client.RABBITMQ.USER&&client.RABBITMQ.PASSWORD){
                    RABBITMQ_URL=`amqp://${client.RABBITMQ.USER}:${client.RABBITMQ.PASSWORD}@${client.RABBITMQ.HOST}:${client.RABBITMQ.PORT}`
                }
                const worker = cluster.fork({ CLIENT_ID: client.ID,RABBITMQ_URL});
                logger.info(`Master: Forked worker for client ${client.ID} (PID: ${worker.process.pid})`);
            });

            // Handle worker exit
            cluster.on('exit', (worker, code, signal) => {
                logger.warn(`Master: Worker ${worker.process.pid} exited with code ${code} (signal: ${signal})`);
                // Optionally restart worker
                const client = clients.find(c => c.ID === worker?.process?.env?.CLIENT_ID);
                if (client) {
                    logger.info(`Master: Restarting worker for client ${client.ID}...`);
                    cluster.fork({ CLIENT_ID: client.ID });
                }
            });

        } catch (error) {
            logger.error('Master: Failed to initialize:', { error: error.message });
            process.exit(1);
        }
    })();
} else {
    // Worker process: Start server for assigned client
    (async () => {
        try {
            clients = await loadClientConfigs();
            const clientId = process.env.CLIENT_ID;
            const client = clients.find(c => c.ID === clientId);

            if (!client) {
                logger.error(`Worker: No configuration found for client ${clientId}`);
                process.exit(1);
            }

            await startServer(client);

            // Handle graceful shutdown
            process.on('SIGTERM', () => shutdown(0, clientId));
            process.on('SIGINT', () => shutdown(0, clientId));

            // Handle unhandled promise rejections
            process.on('unhandledRejection', (reason, promise) => {
                logger.error(`[${clientId}] Unhandled Rejection at:`, { promise, reason: reason.message || reason });
                shutdown(1, clientId);
            });

            // Handle uncaught exceptions
            process.on('uncaughtException', (error) => {
                logger.error(`[${clientId}] Uncaught Exception:`, { error: error.message, stack: error.stack });
                shutdown(1, clientId);
            });

        } catch (error) {
            logger.error(`Worker: Failed to start for client ${process.env.CLIENT_ID}:`, { error: error.message });
            process.exit(1);
        }
    })();
}