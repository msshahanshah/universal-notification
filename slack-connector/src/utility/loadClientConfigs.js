const logger = require("../logger");
const { SecretManager } = require("@universal-notifier/secret-manager");
const config = require("../config.js"); // Environment variables or default configs
/**
 * Loads client configurations from clientList.json and merges with defaults from .env.
 * @returns {Promise<Array<Object>>} - Array of client configurations.
 */

async function loadClientConfigs() {
  try {
    const clients = await SecretManager.getSecrets();

    const defaultConfig = {
      DBCONFIG: {
        HOST: config.dbHost || "localhost",
        PORT: config.dbPort || 5432,
        NAME: config.dbName || "notifications_db",
        USER: config.dbUser || "postgres",
        PASSWORD: config.dbPassword || "admin",
      },
      RABBITMQ: {
        HOST: config.rabbitMQHost || "localhost",
        PORT: config.rabbitMQPort || 5672,
        USER: config.rabbitMQUser || "user",
        PASSWORD: config.rabbitMQPassword || "password",
      },
      SLACKBOT: {
        TOKEN: config.slackBotToken || "",
        RABBITMQ: {
          EXCHANGE_NAME: config.rabbitMQExchangeName || "notifications",
          EXCHANGE_TYPE: config.rabbitMQExchangeType || "direct",
          QUEUE_NAME: config.rabbitMQQueueName || "slack",
          ROUTING_KEY: config.rabbitMQBindingKey || "slack",
        },
      },
    };

    return clients.map((client) => {
      const dbConfig = { ...(client.DBCONFIG || defaultConfig.DBCONFIG) };
      if (process.env.DB_HOST_OVERRIDE)
        dbConfig.HOST = process.env.DB_HOST_OVERRIDE;
      if (process.env.DB_PORT_OVERRIDE)
        dbConfig.PORT = process.env.DB_PORT_OVERRIDE;

      const rabbitConfig = { ...(client.RABBITMQ || defaultConfig.RABBITMQ) };
      if (process.env.RABBITMQ_HOST_OVERRIDE)
        rabbitConfig.HOST = process.env.RABBITMQ_HOST_OVERRIDE;
      if (process.env.RABBITMQ_PORT_OVERRIDE)
        rabbitConfig.PORT = process.env.RABBITMQ_PORT_OVERRIDE;

      return {
        ID: client.ID,
        SERVER_PORT: client.SERVER_PORT || 3000,
        DBCONFIG: dbConfig,
        RABBITMQ: rabbitConfig,
        SLACKBOT: {
          TOKEN: client.SLACKBOT?.TOKEN || defaultConfig.SLACKBOT.TOKEN,
          RABBITMQ:
            client.SLACKBOT?.RABBITMQ || defaultConfig.SLACKBOT.RABBITMQ,
        },
      };
    });
  } catch (error) {
    logger.error("Failed to load client configurations:", {
      error: error.message,
    });
    throw error;
  }
}
module.exports = {
  loadClientConfigs,
};
