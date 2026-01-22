const logger = require("../logger");
const path = require("path");
const fs = require("fs").promises;

const { SecretManager } = require("@universal-notifier/secret-manager");

async function fetchSecrets() {
  try {
    const secrets = await SecretManager.getSecrets();
    return secrets;
  } catch (error) {
    console.error("Failed to fetch secrets:", error.message);
  }
}

/**
 * Loads client configurations from clientList.json and merges with defaults from .env.
 * @returns {Promise<Array<Object>>} - Array of client configurations.
 */
async function loadClientConfigs() {
  try {
    const clients = await fetchSecrets();

    // Default configurations from .env
    const defaultConfig = {
      DBCONFIG: {
        HOST: process.env.POSTGRES_HOST || "localhost",
        PORT: process.env.POSTGRES_PORT || 5432,
        NAME: process.env.POSTGRES_DB || "notifications_db",
        USER: process.env.POSTGRES_USER || "postgres",
        PASSWORD: process.env.POSTGRES_PASSWORD || "admin",
      },
      RABBITMQ: {
        HOST: "localhost",
        PORT: 5672,
        USER: "user",
        PASSWORD: "password",
      },
    };

    // Merge client configs with defaults
    return clients.map((client) => {
      const dbConfig = { ...(client.DBCONFIG || defaultConfig.DBCONFIG) };
      if (process.env.DB_HOST_OVERRIDE)
        dbConfig.HOST = process.env.DB_HOST_OVERRIDE;
      if (process.env.DB_PORT_OVERRIDE)
        dbConfig.PORT = process.env.DB_PORT_OVERRIDE;

      const rabbitConfig = client.RABBITMQ
        ? { ...client.RABBITMQ }
        : { ...defaultConfig.RABBITMQ };
      rabbitConfig.SERVERICES = client.SMS.RABBITMQ;

      if (process.env.RABBITMQ_HOST_OVERRIDE)
        rabbitConfig.HOST = process.env.RABBITMQ_HOST_OVERRIDE;
      if (process.env.RABBITMQ_PORT_OVERRIDE)
        rabbitConfig.PORT = process.env.RABBITMQ_PORT_OVERRIDE;

      return {
        ID: client.ID,
        SERVER_PORT: client.SERVER_PORT || 3000,
        ENABLED_SERVERICES: client.ENABLED_SERVERICES || [],
        DBCONFIG: dbConfig,
        SMS: client.SMS || defaultConfig.SMS,
        RABBITMQ: rabbitConfig,
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
