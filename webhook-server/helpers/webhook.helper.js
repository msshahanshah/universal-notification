/**
 * Checks if a webhook event matches any of the configured service triggers.
 *
 * @param {Object} configs - Configuration object containing service triggers
 * @param {Object} configs.service_trigger - Object in format:
 * {
 *   sms: ["failed", "success"],
 *   email: ["success"]
 * }
 *
 * @param {Object} payload - Webhook payload
 * @param {string} payload.service - Service name (e.g. "sms")
 * @param {string} payload.status - Status (e.g. "failed")
 *
 * @returns {boolean}
 *
 * @example
 * const configs = {
 *   service_trigger: {
 *     sms: ["failed"],
 *     email: ["success"]
 *   }
 * };
 *
 * const payload = { service: "sms", status: "failed" };
 * extractServiceFromServicesTrigger(configs, payload); // true
 */

const extractServiceFromServicesTrigger = (configs, payload) => {
  const triggers = configs?.service_trigger;

  if (!triggers || !payload?.service || !payload?.status) {
    return false;
  }

  const service = payload.service.toLowerCase();
  const status = payload.status.toLowerCase();

  return triggers?.[service]?.some(
    (s) => s.toLowerCase() === status
  ) ?? false;
};

function buildSettings(service_trigger = {}) {
  const SERVICES = ["sms", "email", "slack"];

  const settings = {};
  const finalServiceTrigger = {};

  SERVICES.forEach((service) => {
    const triggers = service_trigger?.[service];

    if (Array.isArray(triggers) && triggers.length > 0) {
      settings[service] = true;
      finalServiceTrigger[service] = triggers;
    } else {
      settings[service] = false;
    }
  });

  return { settings, finalServiceTrigger };
}

module.exports = {
  extractServiceFromServicesTrigger,
  buildSettings
};