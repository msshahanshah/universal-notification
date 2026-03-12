const logger = require("../logger");
const { SecretManager } = require("@universal-notifier/secret-manager");
/**
 * Loads client configurations from clientList.json and merges with defaults.
 * @returns {Promise<Array<Object>>} - Array of client configurations.
 */
async function loadClientConfigs() {
  try {
    const clients = await SecretManager.getSecrets();

    const defaultConfig = {
      DBCONFIG: {
        HOST: process.env.DB_HOST || "localhost",
        PORT: parseInt(process.env.DB_PORT || "5432", 10),
        NAME: process.env.DB_NAME || "notifications_db",
        USER: process.env.DB_USER || "postgres",
        PASSWORD: process.env.DB_PASSWORD || "",
      },
      RABBITMQ: {
        HOST: process.env.RABBITMQ_HOST || "localhost",
        PORT: parseInt(process.env.RABBITMQ_PORT || "5672", 10),
        USER: process.env.RABBITMQ_USER || "guest",
        PASSWORD: process.env.RABBITMQ_PASSWORD || "",
      },
      WHATSAPP: {
        ACCOUNT_SID: process.env.ACCOUNT_SID,
        AUTH_TOKEN: process.env.AUTH_TOKEN,
        FROM_NUMBER: process.env.FROM_NUMBER,
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
        WHATSAPP: client.WHATSAPP || defaultConfig.WHATSAPP,
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
