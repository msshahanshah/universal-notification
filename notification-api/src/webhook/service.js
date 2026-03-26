const logger = require("../logger");

const {
  fetchWebhookConfigs,
  addWebhookGRPC,
  updateWebhookGRPC,
  deleteWebhookGRPC,
  fetchWebhookLogs,
} = require("../webhook/client");

const {
  getCacheTriggerServices,
  cacheTriggerServices,
} = require("../../helpers/webhookCache.helper");

// ---------------- ADD ----------------
async function addWebhook(payload, clientId) {
  try {
    payload.clientId = clientId;

    const services = await addWebhookGRPC(payload);

    cacheTriggerServices(clientId, services)
      .then(() => {
        logger.info(`Webhook trigger services updated for ${clientId}`);
      })
      .catch(() => {
        logger.error(`Failed to update trigger services for ${clientId}`);
      });

    return { services };
  } catch (error) {
    throw error;
  }
}

// ---------------- UPDATE ----------------
async function updateWebhook(payload, webhookId, clientId) {
  try {
    payload.webhookId = webhookId;
    payload.clientId = clientId;

    const services = await updateWebhookGRPC(payload);

    cacheTriggerServices(clientId, services).catch(() => {
      logger.error(`Failed to update trigger services for ${clientId}`);
    });

    return { services };
  } catch (error) {
    throw error;
  }
}

// ---------------- DELETE ----------------
async function deleteWebhook(webhookId, clientId) {
  try {
    const services = await deleteWebhookGRPC({ webhookId, clientId });

    cacheTriggerServices(clientId, services).catch(() => {
      logger.error(`Failed to update trigger services for ${clientId}`);
    });

    return { services };
  } catch (error) {
    throw error;
  }
}

// ---------------- GET CONFIG ----------------
async function getWebhookConfigs(clientId, query) {
  return await fetchWebhookConfigs(clientId, query);
}

// ---------------- GET CONFIG ----------------
async function getWebhookLogs(clientId, query) {
  return await fetchWebhookLogs(clientId, query);
}

// ---------------- ENABLED SERVICES ----------------
async function getWebhookEnabledServices(clientId, service) {
  let services = [];
  try {
    services = await getCacheTriggerServices(clientId);

    if (!services.length) {
      const { enabledServices } = await fetchWebhookConfigs(clientId, {
        fields: "enabledServices",
      });

      services = await cacheTriggerServices(clientId, enabledServices);
    }

    return service ? services.includes(service) : services;
  } catch (error) {
    logger.error(
      `failed to fetch enabled services for client ${clientId}, ERROR: ${JSON.stringify(error)}`,
    );
  } finally {
    return service ? services.includes(service) : services;
  }
}

module.exports = {
  addWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhookConfigs,
  getWebhookLogs,
  getWebhookEnabledServices,
};
