const {
  RabbitMQManager,
  SecretManager,
} = require("@universal-notifier/secret-manager");
const logger = require("./logger");

const rabbitManager = new RabbitMQManager(
  SecretManager.getSecrets.bind(SecretManager),
  logger,
);

module.exports = rabbitManager;
