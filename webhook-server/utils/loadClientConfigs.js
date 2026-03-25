const logger = require("./logger");
const { SecretManager } = require("universal_notification_support_lib");
/**
 * Loads client configurations from clientList.json and merges with defaults.
 * @returns {Promise<Array<Object>>} - Array of client configurations.
 */
async function loadClientConfigs() {
  try {
    const clients = await SecretManager.getSecrets();

    return clients.map((client) => {
      const dbConfig = { ...client.DBCONFIG };
      if (process.env.DB_HOST_OVERRIDE)
        dbConfig.HOST = process.env.DB_HOST_OVERRIDE;
      if (process.env.DB_PORT_OVERRIDE)
        dbConfig.PORT = process.env.DB_PORT_OVERRIDE;

      const rabbitConfig = { ...client.RABBITMQ };
      if (process.env.RABBITMQ_HOST_OVERRIDE)
        rabbitConfig.HOST = process.env.RABBITMQ_HOST_OVERRIDE;
      if (process.env.RABBITMQ_PORT_OVERRIDE)
        rabbitConfig.PORT = process.env.RABBITMQ_PORT_OVERRIDE;

      return {
        ID: client.ID,
        SERVER_PORT: client.SERVER_PORT || 3000,
        DBCONFIG: dbConfig,
        RABBITMQ: rabbitConfig,
        EMAIL: client.EMAIL,
      };
    });
  } catch (error) {
    logger.error("Failed to load client configurations:", {
      message: error.message,
      stack: error?.stack,
    });
    throw error;
  }
}

module.exports = {
  loadClientConfigs,
};
