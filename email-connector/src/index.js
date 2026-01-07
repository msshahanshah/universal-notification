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
            })
            cluster.on('exit', (worker, code, signal) => {
                logger.warn(`Master: Worker ${worker.process.pid} exited with code ${code} (signal: ${signal})`);
                const client = clients.find(c => c.ID === worker?.process?.env?.CLIENT_ID);
                if (client) {
                    logger.info(`Master: Restarting worker for client ${client.ID}...`);
                    cluster.fork({ CLIENT_ID: client.ID, RABBITMQ_URL: `amqp://${client.RABBITMQ.USER}:${client.RABBITMQ.PASSWORD}@${client.RABBITMQ.HOST}:${client.RABBITMQ.PORT}` });
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

            if (!clientConfigList) {
                logger.error(`Worker: No configuration found for client ${process.env.clientList}`);
                process.exit(1);
            }

            await connectAndConsume(clientConfigList);

            process.on('SIGTERM', () => closeConnections(process.env.clientList));
            process.on('SIGINT', () => closeConnections(process.env.clientList));
            process.on('unhandledRejection', (reason, promise) => {
                logger.error(`[${process.env.clientList}] Unhandled Rejection at:`, { promise, reason: reason.message || reason });
                closeConnections(process.env.clientList).then(() => process.exit(1));
            });
            process.on('uncaughtException', (error) => {
                logger.error(`[${process.env.clientList}] Uncaught Exception:`, { error: error.message, stack: error.stack });
                closeConnections(process.env.clientList).then(() => process.exit(1));
            });
        } catch (error) {
            logger.error(`Worker: Failed to start for client ${process.env.CLIENT_ID}:`, { error: error.message });
            process.exit(1);
        }
    })();
}