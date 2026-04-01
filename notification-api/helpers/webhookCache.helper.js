const RedisHelper = require('./redis.helper');

const getTriggerKey = (clientId) => `webhook:triggers:services:${clientId}`;

async function getCacheTriggerServices(clientId) {
  return await RedisHelper.smembers(getTriggerKey(clientId));
}

async function cacheTriggerServices(clientId, services) {
  return RedisHelper.sadd(getTriggerKey(clientId), services);
}

module.exports = {
  getCacheTriggerServices,
  cacheTriggerServices,
};
