const {
  RabbitMQManager,
  SecretManager,
} = require("universal_notification_support_lib");
const logger = require("../logger");

const rabbitManager = new RabbitMQManager(
  SecretManager.getSecrets.bind(SecretManager),
  logger,
);

module.exports = rabbitManager;
