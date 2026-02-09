const cluster = require("cluster");
require("dotenv").config();   
const path = require("path");
const express = require("express");
const httpProxy = require("http-proxy");
const config = require("./config");
const logger = require("./logger");
const { Sequelize } = require("sequelize");
const connectionManager = require("./utillity/connectionManager");
const { loadClientConfigs } = require("./utillity/loadClientConfigs");
// const { Server } = require("socket.io");   // <-- KEEPING YOUR COMMENT
const WebSocket = require("ws");
const jwt = require("jsonwebtoken")

let server = null;
let masterServer = null;

/**
 * Starts the server for each client (worker process)
 */
async function startServer(clientConfigList) {
  logger.info(`[${process.env.clientList}] Starting server...`);

  try {
    // Initialize DB + RabbitMQ for each client
    for (const clientItem of clientConfigList) {
      await connectionManager.initializeSequelize(clientItem.DBCONFIG, clientItem.ID);
      await connectionManager.initializeRabbitMQ(clientItem.RABBITMQ, clientItem.ID);
    }

    global.connectionManager = connectionManager;

    const app = require("./app");

    // Start worker HTTP server
    server = app.listen(process.env.SERVER_PORT, () => {
      logger.info(
        `[${process.env.clientList}] Notification API listening on port ${process.env.SERVER_PORT}`
      );
    });
    console.log(process.env.REQ_URL);
    const wss = new WebSocket.Server({ server });
    wss.on("connection", (ws, req) => {
      const url = new URL(req.url, process.env.REQ_URL);
      const clientId = url.searchParams.get("clientId");
      const token = url.searchParams.get("token");
      console.log(token)

      if (!token) {
        logger.warn("WS Missing token for", clientId);
        ws.close(4001, "Authorization denied");
        return;
      }

      try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        ws.user = decoded;
        logger.info(`WS Auth Success: clientId=${clientId}`, decoded);
      } catch (err) {
        logger.warn(`WS Invalid token for clientId=${clientId} → ${err.message}`);
        ws.close(4002, "Token is not valid or has expired");
        return;
      }

      logger.info(`WS Connected: clientId=${clientId}`);

      ws.on("message", (msg) => {
        logger.info(`WS Message from ${msg}`);
      });

      ws.send(JSON.stringify({ type: "connected", clientId }));
    });

    app.set("ws", wss);

    return server;
  } catch (error) {
    logger.error(`[${process.env.clientList}] Failed to start server:`, {
      error: error.message,
      stack: error.stack,
    });

    await shutdown(1, process.env.clientList);
  }
}

/**
 * Shutdown helper
 */
async function shutdown(exitCode = 0, clientId = "unknown", server) {
  logger.info(`[${clientId}] Shutting down server...`);

  if (server) {
    await new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) return reject(err);
        resolve();
      });

      setTimeout(() => reject(new Error("Server close timeout")), 10000);
    }).catch((err) => logger.error(`[${clientId}] ${err.message}`));

    server = null;
  }

  if (global.connectionManager) {
    await global.connectionManager.closeAllTypeConnection(clientId);
  }

  logger.info(`[${clientId}] Shutdown complete.`);
  process.exit(exitCode);
}

let clients = [];

/**
 * MASTER PROCESS
 */
if (cluster.isMaster) {
  (async () => {
    try {
      clients = await loadClientConfigs();
      logger.info(`Master: Loaded ${clients.length} clients.`);

      const proxy = httpProxy.createProxyServer({});

      /**
       * MASTER Router (HTTP + WebSocket)
       */
      const masterApp = express();
      masterApp.use(require("cors")());

      // HTTP Routing (headers)
      masterApp.use((req, res) => {
        const clientId = req.headers["x-client-id"];
        const client = clients.find((c) => c.ID === clientId);

        if (!client) {
          logger.warn("Invalid or missing X-Client-Id", { clientId });
          return res
            .status(400)
            .json({ error: "Invalid or missing X-Client-Id header" });
        }

        proxy.web(req, res, {
          target: `http://localhost:${client.SERVER_PORT}`,
        });
      });

      // Master HTTP Server
      masterServer = masterApp.listen(3000, () => {
        logger.info("Master router listening on port 3000");
      });

      masterServer.on("upgrade", (req, socket, head) => {
        const url = new URL(req.url, process.env.REQ_URL);
        const clientId = url.searchParams.get("clientId");

        if (!clientId) {
          logger.warn("WS: Missing clientId in query");
          socket.destroy();
          return;
        }

        const client = clients.find((c) => c.ID === clientId);
        if (!client) {
          logger.warn("WS: Invalid clientId", { clientId });
          socket.destroy();
          return;
        }

        logger.info(`WS Upgrade: clientId=${clientId} → port ${client.SERVER_PORT}`);

        proxy.ws(
          req,
          socket,
          head,
          { target: `http://localhost:${client.SERVER_PORT}` },
          (err) => {
            // Prevent crash
            logger.error("WS Proxy Error:", err?.message);
            socket.destroy();
          }
        );
      });

      /**
       * Start workers
       */
      const uniquePorts = new Set(clients.map((c) => c.SERVER_PORT));

      uniquePorts.forEach((port) => {
        let clientList = clients
          .filter((c) => c.SERVER_PORT === port)
          .map((c) => c.ID)
          .join(",");

        const worker = cluster.fork({ SERVER_PORT: port, clientList });

        logger.info(
          `Master: Forked worker for client(s) ${clientList} (PID: ${worker.process.pid})`
        );
      });

      /**
       * Restart worker on crash
       */
      cluster.on("exit", (worker, code, signal) => {
        logger.warn(
          `Worker ${worker.process.pid} exited with code ${code}, restarting...`
        );

        // FIX: correct env lookup
        const port = worker.process.env.SERVER_PORT;
        const list = worker.process.env.clientList;

        cluster.fork({ SERVER_PORT: port, clientList: list });
      });

    } catch (error) {
      logger.error("Master Init Error:", { error: error.message });
      process.exit(1);
    }
  })();

} else {
  /**
   * WORKER PROCESS
   */
  (async () => {
    try {
      if (!process.env.clientList) {
        logger.error("Worker: No clientList env found");
        process.exit(1);
      }

      clients = await loadClientConfigs();
      const clientConfigList = clients.filter(
        (c) => c.SERVER_PORT === +process.env.SERVER_PORT
      );

      const server = await startServer(clientConfigList);

      // Graceful shutdown
      process.on("SIGTERM", () => shutdown(0, process.env.clientList, server));
      process.on("SIGINT", () => shutdown(0, process.env.clientList, server));

      // Error handlers
      process.on("unhandledRejection", (reason, promise) => {
        logger.error("Unhandled Rejection:", { reason });
      });

      process.on("uncaughtException", (error) => {
        logger.error("Uncaught Exception:", { error });
        shutdown(1, process.env.clientList);
      });

    } catch (error) {
      logger.error(
        `Worker start failed (${process.env.clientList})`,
        { error: error.message }
      );
      process.exit(1);
    }
  })();
}
