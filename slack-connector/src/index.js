const cluster = require("cluster");
const logger = require("./logger");
const { connectAndConsume, closeConnections } = require("./connector");
const { loadClientConfigs } = require("./utility/loadClientConfigs.js");
const connectionManager = require("./utility/connectionManager.js");
const express = require("express");
const slackRoute = require("./slack/route.js");

/**
 * Loads client configurations from clientList.json and merges with defaults.
 * @returns {Promise<Array<Object>>} - Array of client configurations.
 */

async function startServer(clientConfigList) {
  try {
    // Initialize client-specific Sequelize

    for (const clientItem of clientConfigList) {
      await connectionManager.initializeSequelize(
        clientItem.DBCONFIG,
        clientItem.ID,
      );
    }
    const SERVER_PORT = process.env.PORT || 3000;
    global.connectionManager = connectionManager;
    const app = express();
    app.use(express.json());
    app.use(require("cors")());
    app.use("/", slackRoute);

    const server = app.listen(SERVER_PORT, () => {
      logger.info(`Slack Service is listening on port ${SERVER_PORT}`);
    });
    return server;
  } catch (error) {
    logger.error(`[${process.env.clientList}] Failed to start server:`, {
      error: error.message,
      stack: error.stack,
    });
    await shutdown(1, process.env.clientList);
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

      clients.forEach((client) => {
        const RABBITMQ_URL = `amqp://${client.RABBITMQ.USER}:${client.RABBITMQ.PASSWORD}@${client.RABBITMQ.HOST}:${client.RABBITMQ.PORT}`;
        const worker = cluster.fork({ CLIENT_ID: client.ID, RABBITMQ_URL });
        workerDataMap.set(worker.id, {
          clientId: client.ID,
          rabbitMQUrl: RABBITMQ_URL,
        });
        logger.info(
          `Master: Forked worker for client ${client.ID} (PID: ${worker.process.pid})`,
        );
      });

      cluster.on("exit", (worker, code, signal) => {
        logger.warn(
          `Master: Worker ${worker.process.pid} exited with code ${code} (signal: ${signal})`,
        );
        const workerData = workerDataMap.get(worker.id);
        if (workerData) {
          const { clientId, rabbitMQUrl } = workerData;
          logger.info(`Master: Restarting worker for client ${clientId}...`);
          const newWorker = cluster.fork({
            CLIENT_ID: clientId,
            RABBITMQ_URL: rabbitMQUrl,
          });
          workerDataMap.set(newWorker.id, workerData);
          workerDataMap.delete(worker.id);
        } else {
          logger.error(
            "Master: Unable to restart worker - missing worker data",
          );
        }
      });
    } catch (error) {
      logger.error("Master: Failed to initialize:", { error: error.message });
      process.exit(1);
    }
  })();
} else {
  (async () => {
    try {
      let clients = await loadClientConfigs();
      const clientId = process.env.CLIENT_ID;

      const client = clients.find((c) => c.ID === clientId);

      if (!client) {
        logger.error(
          `Worker: No configuration found for client ${clientId} \n`,
        );
        process.exit(1);
      }

      const server = await startServer([client]);

      await connectAndConsume(client);
      process.on("SIGTERM", () => shutdown(0, process.env.clientList, server));
      process.on("SIGINT", () => shutdown(0, process.env.clientList, server));
      process.on("SIGTERM", () => closeConnections(clientId));
      process.on("SIGINT", () => closeConnections(clientId));
      process.on("unhandledRejection", (reason, promise) => {
        logger.error(`[${clientId}] Unhandled Rejection at: \n`, {
          promise,
          reason: reason.message || reason,
        });
        closeConnections(clientId).then(() => process.exit(1));
      });
      process.on("uncaughtException", (error) => {
        logger.error(`[${clientId}] Uncaught Exception: \n`, {
          error: error.message,
          stack: error.stack,
        });
        closeConnections(clientId).then(() => process.exit(1));
      });
    } catch (error) {
      logger.error(
        `Worker: Failed to start for client ${process.env.CLIENT_ID}: \n`,
        { error: error.message },
      );
      process.exit(1);
    }
  })();
}
