const webhookGRPCClient = require("../gRPC/webhook.client");
const grpc = require("@grpc/grpc-js");
const grpcHelper = require("../../helpers/grpc.helper");

const getMetadata = () => {
  const metadata = new grpc.Metadata();
  metadata.add("x-internal-key", process.env.INTERNAL_GRPC_KEY);
  return metadata;
};

async function fetchWebhookConfigs(clientId, query) {
  const payload = { clientId, query };

  const { data } = await grpcHelper.getWebhooks(
    webhookGRPCClient,
    payload,
    getMetadata(),
  );

  return data;
}

async function addWebhookGRPC(payload) {
  const { services } = await grpcHelper.addWebhook(
    webhookGRPCClient,
    payload,
    getMetadata(),
  );
  return services;
}

async function updateWebhookGRPC(payload) {
  const { services } = await grpcHelper.updateWebhook(
    webhookGRPCClient,
    payload,
    getMetadata(),
  );
  return services;
}

async function deleteWebhookGRPC(payload) {
  const { services } = await grpcHelper.deleteWebhook(
    webhookGRPCClient,
    payload,
    getMetadata(),
  );
  return services;
}

module.exports = {
  fetchWebhookConfigs,
  addWebhookGRPC,
  updateWebhookGRPC,
  deleteWebhookGRPC,
};
