const webhookGRPCClient = require("../gRPC/webhook.client");
const grpc = require("@grpc/grpc-js");
const grpcHelper = require("../../helpers/grpc.helper");
const { decrypt } = require("../../../webhook/utils/cryptoUtil");

async function addWebhook(payload, clientId) {
  try {
    const metadata = new grpc.Metadata();
    metadata.add("x-internal-key", process.env.INTERNAL_GRPC_KEY);
    payload.clientId = clientId;

    const { services } = await grpcHelper.addWebhook(
      webhookGRPCClient,
      payload,
      metadata,
    );

    return { services };
  } catch (error) {
    throw error;
  }
}

async function updateWebhook(payload, webhookId, clientId) {
  try {
    const metadata = new grpc.Metadata();
    metadata.add("x-internal-key", process.env.INTERNAL_GRPC_KEY);

    payload.webhookId = webhookId;
    payload.clientId = clientId;

    const { services } = await grpcHelper.updateWebhook(
      webhookGRPCClient,
      payload,
      metadata,
    );

    return { services };
  } catch (error) {
    throw error;
  }
}

async function deleteWebhook(webhookId, clientId) {
  try {
    const metadata = new grpc.Metadata();
    metadata.add("x-internal-key", process.env.INTERNAL_GRPC_KEY);

    const payload = {
      webhookId,
      clientId,
    };

    const { services } = await grpcHelper.deleteWebhook(
      webhookGRPCClient,
      payload,
      metadata,
    );

    return { services };
  } catch (error) {
    throw error;
  }
}

async function getWebhooks(clientId) {
  try {
    const metadata = new grpc.Metadata();
    metadata.add("x-internal-key", process.env.INTERNAL_GRPC_KEY);

    const payload = {
      clientId,
    };

    const { data } = await grpcHelper.getWebhooks(
      webhookGRPCClient,
      payload,
      metadata,
    );

    const webhooks = data.map((webhook) => {
      return {
        id: webhook._id,
        webhookUrl: webhook.webhookUrl,
        serviceTrigger: webhook.serviceTrigger,
        retryEnabled: webhook.retryEnabled,
        isActive: webhook.isActive,
      };
    });

    return data;
  } catch (error) {
    throw error;
  }
}

module.exports = { addWebhook, updateWebhook, deleteWebhook, getWebhooks };
