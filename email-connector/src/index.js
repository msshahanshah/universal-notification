const cluster = require('cluster');

const logger = require('./logger');

const { connectAndConsume, closeConnections } = require('./connector');
const { loadClientConfigs } = require('./utillity/loadClientConfigs');


// Master and Worker Logic
if (cluster.isMaster) {
    (async () => {
        try {
            let clients = await loadClientConfigs();
            logger.info(`Master: Loaded ${clients.length} clients.`);

            //Find Unique ports for server
            const uniquePorts = new Set(clients.map(client => client.SERVER_PORT));
            uniquePorts.forEach(port => {
                let clientList = clients.filter(client => client.SERVER_PORT === port).map(item => item.ID).join(',');
                const worker = cluster.fork({ SERVER_PORT: port, clientList });
                logger.info(`Master: Forked worker for client ${clientList} (PID: ${worker.process.pid})`);
            });
            cluster.on('exit', (worker, code, signal) => {
                logger.warn(`Master: Worker ${worker.process.pid} exited with code ${code} (signal: ${signal})`);
                // Retrieve the original fork parameters from the worker
                const port = worker.process.env.SERVER_PORT;
                const workerClientList = worker.process.env.clientList;
                if (port && workerClientList) {
                    logger.info(`Master: Restarting worker for port ${port} (clients: ${workerClientList})...`);
                    cluster.fork({ SERVER_PORT: port, clientList: workerClientList });
                } else {
                    logger.error('Master: Unable to restart worker - missing configuration');
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
            const clientConfigList = clients.filter(c => c.SERVER_PORT === +process.env.SERVER_PORT);

            if (!clientConfigList || clientConfigList.length === 0) {
                logger.error(`Worker: No configuration found for clients ${process.env.clientList}`);
                process.exit(1);
            }

            await connectAndConsume(clientConfigList);

            process.on('SIGTERM', async () => {
                await closeConnections(process.env.clientList);
                process.exit(0);
            });
            process.on('SIGINT', async () => {
                await closeConnections(process.env.clientList);
                process.exit(0);
            });
            process.on('unhandledRejection', (reason, promise) => {
                logger.error(`[${process.env.clientList}] Unhandled Rejection at:`, { promise, reason: reason.message || reason });
                closeConnections(process.env.clientList).then(() => process.exit(1));
            });
            process.on('uncaughtException', (error) => {
                logger.error(`[${process.env.clientList}] Uncaught Exception:`, { error: error.message, stack: error.stack });
                closeConnections(process.env.clientList).then(() => process.exit(1));
            });
        } catch (error) {
            logger.error(`Worker: Failed to start for clients ${process.env.clientList}:`, { error: error.message });
            process.exit(1);
        }
    })();
}