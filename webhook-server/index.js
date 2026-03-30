require("dotenv").config();

const logger = require("./utils/logger");
const { connectMongoose } = require("./helpers/mongoose.helper");
const connectionManager = require("./utils/connectionManager");
const { consumer } = require("./utils/consumer");
const {
  addWebhook,
  updateWebhook,
  deleteWebhook,
  allWebhook,
  getAllWebhookLogs,
} = require("./services/webhook.service");

const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const { loadClientConfigs } = require("./utils/loadClientConfigs");

const PROTO_PATH = process.env.PROTO_PATH || "./proto/webhook.proto";

let grpcServer = null;
let isShuttingDown = false;

async function connectAndConsume() {
  try {
    const clientConfigList = await loadClientConfigs();
    if (!Array.isArray(clientConfigList)) {
      throw new Error("clientConfigList must be an array");
    }

    const results = await Promise.allSettled(
      clientConfigList.map(async (clientItem) => {
        if (!clientItem?.ID) {
          throw new Error("Invalid client config: missing ID");
        }

        const rabbitClient = await connectionManager.getRabbitMQ(clientItem.ID);

        if (!rabbitClient || typeof rabbitClient.consume !== "function") {
          throw new Error(
            `RabbitMQ client not available for client ${clientItem.ID}`,
          );
        }

        await rabbitClient.consume({
          service: "webhook",
          sender: consumer,
          db: null,
          maxProcessAttemptCount: 3,
        });

        logger.info(`RabbitMQ consumer started for client ${clientItem.ID}`);
      }),
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      failed.forEach((f) => {
        logger.error(`Failed to start one of the consumers: ${JSON.stringify({ error: f.reason?.message || f.reason, stack: f.reason?.stack })}`);
      });
      logger.error(`Failed to start ${failed.length} RabbitMQ consumer(s)`);
      return;
    }

    logger.info("All RabbitMQ consumers initialized successfully.");
  } catch (error) {
    logger.error(`error in connection and Consume; ${JSON.stringify(error)}`);
  }
}

function startGrpcServer() {
  return new Promise((resolve, reject) => {
    try {
      const packageDef = protoLoader.loadSync(PROTO_PATH);

      const grpcObj = grpc.loadPackageDefinition(packageDef);
      const webhookPackage = grpcObj?.webhook;

      if (!webhookPackage?.WebhookService?.service) {
        return reject(
          new Error(
            "Invalid gRPC package definition: WebhookService not found",
          ),
        );
      }

      grpcServer = new grpc.Server();

      grpcServer.addService(webhookPackage.WebhookService.service, {
        AddWebhookConfig: addWebhook,
        UpdateWebhookConfig: updateWebhook,
        DeleteWebhookConfig: deleteWebhook,
        AllWebhookConfig: allWebhook,
        GetAllWebhookLogs: getAllWebhookLogs,
      });

      const GRPC_HOST = process.env.GRPC_HOST;
      const GRPC_PORT = process.env.GRPC_PORT;

      if (!GRPC_HOST || !GRPC_PORT) {
        return reject(
          new Error(
            "GRPC_HOST or GRPC_PORT is missing in environment variables",
          ),
        );
      }

      grpcServer.bindAsync(
        `${GRPC_HOST}:${GRPC_PORT}`,
        grpc.ServerCredentials.createInsecure(),
        (err, port) => {
          if (err) {
            logger.error(`Failed to bind gRPC server: ${JSON.stringify({ error: err.message, stack: err.stack })}`);
            return reject(err);
          }

          grpcServer.start();
          logger.info(`Webhook gRPC server running on ${GRPC_HOST}:${port}`);
          resolve();
        },
      );
    } catch (err) {
      logger.error(`Failed to start gRPC server: ${JSON.stringify({ error: err.message, stack: err.stack })}`);
      reject(err);
    }
  });
}

async function start() {
  try {
    await connectMongoose();
    logger.info("MongoDB connected successfully.");

    // If you already have client configs, pass them here.
    // Otherwise keep this empty or wire it to your config source.

    await connectAndConsume();

    // start Grpc server
    await startGrpcServer();

    // start cron schedular
    require("./cron/webhookCron");

    logger.info("[WEBHOOK SERVICE] Server started successfully.");
  } catch (err) {
    logger.error(`[WEBHOOK SERVICE] Failed to start: ${JSON.stringify({ error: err.message, stack: err.stack })}`);
  }
}

start();
