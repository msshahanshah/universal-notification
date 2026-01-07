const cluster = require('cluster');


const express = require('express');
const httpProxy = require('http-proxy');
const config = require('./config');
const logger = require('./logger');
const { Sequelize } = require('sequelize');
const connectionManager = require('./utillity/connectionManager');
const { loadClientConfigs } = require('./utillity/loadClientConfigs');

/**
 * @type {import('http').Server|null}
 */


/**
 * Starts the server for a specific client.
 * @param {Object} client - Client configuration.
 * @returns {Promise<void>}
 */
async function startServer(clientConfigList) {
    logger.info(`[${process.env.clientList}] Starting server...`);
    try {
        // Initialize client-specific Sequelize
        for (const clientItem of clientConfigList) {
            await connectionManager.initializeSequelize(clientItem.DBCONFIG, clientItem.ID);
            await connectionManager.initializeRABBITMQ(clientItem.RABBITMQ ,clientItem.ID)
          }
        global.connectionManager=connectionManager;
        const app = require('./app');
        // Start HTTP Server
        server = app.listen(process.env.SERVER_PORT, () => {
            logger.info(`[${process.env.clientList}] Notification API listening on port ${process.env.SERVER_PORT} in ${config.env} mode`);
        });
        return server;
    } catch (error) {
        logger.error(`[${process.env.clientList}] Failed to start server:`, { error: error.message, stack: error.stack });
        await shutdown(1, process.env.clientList);
    }
}

/**
 * Shuts down the server for a specific client.
 * @param {number} [exitCode=0] - Exit code.
 * @param {string} [clientId='unknown'] - Client identifier.
 * @returns {Promise<void>}
 */
async function shutdown(exitCode = 0, clientId = 'unknown',server) {
    logger.info(`[${clientId}] Shutting down server...`);

    // Close HTTP server
    if (server) {
        await new Promise((resolve, reject) => {
            if(server){
                server.close((err) => {
                    if (err) {
                        logger.error(`[${clientId}] Error closing HTTP server:`, err);
                        return reject(err);
                    }
                    logger.info(`[${clientId}] HTTP server closed.`);
                    resolve();
                });
                setTimeout(() => reject(new Error('HTTP server close timeout')), 10000).unref();
            }else{
                logger.info(`[${clientId}] HTTP server already closed.`);
                resolve();
            }
            
        }).catch(err => logger.error(`[${clientId}] ${err.message}`));
        server = null;
    }
  
    // Close Database connection
    if (global.connectionManager) {
        await global.connectionManager.closeAllTypeConnection(clientId);
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
            try {
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
            } catch (error) {
                console.log("error", error)
            }
            //Find Unique ports for server
            const uniquePorts = new Set(clients.map(client => client.SERVER_PORT));
            uniquePorts.forEach(port => {
                let clientList = clients.filter(client => client.SERVER_PORT === port).map(item=>item.ID).join(',');
                const worker = cluster.fork({SERVER_PORT:port,clientList});
                logger.info(`Master: Forked worker for client ${clientList} (PID: ${worker.process.pid})`);
            })

            // Handle worker exit
            cluster.on('exit', (worker, code, signal) => {
                logger.warn(`Master: Worker ${worker.process.pid} exited with code ${code} (signal: ${signal})`);
                // Optionally restart worker
                // const client = clients.find(c => c.ID === worker?.process?.env?.CLIENT_ID);
                // if (client) {
                //     logger.info(`Master: Restarting worker for client ${client.ID}...`);
                //     cluster.fork({ CLIENT_ID: client.ID });
                // }
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
            if(!process.env.clientList){
                logger.error(`Worker: No configuration found for client`);
                process.exit(1);
            }
            
            clients = await loadClientConfigs();
            const clientConfigList = clients.filter(c => c.SERVER_PORT === +process.env.SERVER_PORT);

            let server=await startServer(clientConfigList);

            // Handle graceful shutdown
            process.on('SIGTERM', () => shutdown(0,process.env.clientList,server));
            process.on('SIGINT', () => shutdown(0,process.env.clientList,server));

            // Handle unhandled promise rejections
            process.on('unhandledRejection', (reason, promise) => {
                logger.error(`[${process.env.clientList}] Unhandled Rejection at:`, { promise, reason: reason.message || reason });
                //shutdown(1,process.env.clientList);
            });

            // Handle uncaught exceptions
            process.on('uncaughtException', (error) => {
                logger.error(`[${process.env.clientList}] Uncaught Exception:`, { error: error.message, stack: error.stack });
                shutdown(1,process.env.clientList);
            });

        } catch (error) {
            logger.error(`Worker: Failed to start for client ${process.env.clientList}:`, { error: error.message });
            process.exit(1);
        }
    })();
}