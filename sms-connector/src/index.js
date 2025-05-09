const cluster = require('cluster');
const logger = require('./logger');
const { connectAndConsume, closeConnections } = require('./connector');
const { loadClientConfigs } = require('./utillity/loadClientConfigs');

// Master process logic
if (cluster.isMaster) {
    (async () => {
        try {
            // Load client configurations once in the master
            const clients = await loadClientConfigs();
            logger.info(`Master: Loaded ${clients.length} clients.`);

            // Handle case with no clients
            if (clients.length === 0) {
                logger.warn('Master: No clients configured. No workers will be started.');
                return;
            }

            // Map to track worker data for restarts
            const workerDataMap = new Map();

            // Get unique server ports
            const uniquePorts = new Set(clients.map(client => client.SERVER_PORT));

            // Fork a worker for each unique port
            uniquePorts.forEach(port => {
                const clientList = clients
                    .filter(client => client.SERVER_PORT === port)
                    .map(client => client.ID)
                    .join(',');
                const worker = cluster.fork({ SERVER_PORT: port, clientList });
                workerDataMap.set(worker.id, { port, clientList });
                logger.info(`Master: Forked worker for clients ${clientList} on port ${port} (PID: ${worker.process.pid})`);
            });

            // Handle worker exit and restart
            cluster.on('exit', (worker, code, signal) => {
                logger.warn(`Master: Worker ${worker.process.pid} exited with code ${code} (signal: ${signal})`);
                const workerData = workerDataMap.get(worker.id);
                if (workerData) {
                    const { port, clientList } = workerData;
                    logger.info(`Master: Restarting worker for port ${port} and clients ${clientList}...`);
                    const newWorker = cluster.fork({ SERVER_PORT: port, clientList });
                    workerDataMap.set(newWorker.id, { port, clientList });
                    workerDataMap.delete(worker.id); // Clean up old worker entry
                }
            });
        } catch (error) {
            logger.error('Master: Failed to initialize:', { error: error.message });
            process.exit(1);
        }
    })();
} else {
    // Worker process logic
    (async () => {
        try {
            // Load client configurations in the worker
            const clients = await loadClientConfigs();
            const serverPort = +process.env.SERVER_PORT;
            const clientConfigList = clients.filter(c => c.SERVER_PORT === serverPort);

            // Validate that we have clients for this port
            if (clientConfigList.length === 0) {
                logger.error(`Worker: No clients found for port ${serverPort}`);
                process.exit(1);
            }

            // Start consuming messages for the clients
            await connectAndConsume(clientConfigList);
            logger.info(`Worker: Started for port ${serverPort} with ${clientConfigList.length} clients`);

            // Graceful shutdown handlers
            const shutdown = () => closeConnections(process.env.clientList);

            process.on('SIGTERM', shutdown);
            process.on('SIGINT', shutdown);

            // Error handlers
            process.on('unhandledRejection', (reason, promise) => {
                logger.error(`[${process.env.clientList}] Unhandled Rejection at:`, { promise, reason: reason.message || reason });
                closeConnections(process.env.clientList).then(() => process.exit(1));
            });

            process.on('uncaughtException', (error) => {
                logger.error(`[${process.env.clientList}] Uncaught Exception:`, { error: error.message, stack: error.stack });
                closeConnections(process.env.clientList).then(() => process.exit(1));
            });
        } catch (error) {
            logger.error(`Worker: Failed to start for port ${process.env.SERVER_PORT}:`, { error: error.message });
            process.exit(1);
        }
    })();
}