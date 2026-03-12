const webhookGRPCClient = require("../gRPC/webhook.client");
const grpc = require("@grpc/grpc-js");
const grpcHelper = require("../../helpers/grpc.helper");

async function addWebhook(payload, clientId) {
  try {
    const metadata = new grpc.Metadata();
    metadata.add("x-internal-key", process.env.INTERNAL_GRPC_KEY);

    // send add webhook request by calling add webhook function in webhook service
    const { services } = await grpcHelper.addWebhook(
      webhookGRPCClient,
      payload,
      metadata,
    );

    // if from webhook service response comes success then update enable service for webhook
    const dbConnect = await global.connectionManager.getModels(clientId);

    for (let serviceName of Object.keys(services)) {
      //get service name
      const existingService = await dbConnect.services.findOne({
        where: { name: serviceName },
      });
      if (!existingService) {
        throw {
          statusCode: 404,
          message: `Service ${serviceName} does not present`,
        };
      }

      //checking client service exist in client_service_settings table to update setting for webhook status
      const existingClientService = await dbConnect.ClientServiceSetting.find({
        where: {
          serviceId: existingService.id,
          clientId,
        },
      });
      if (!existingClientService) {
        throw {
          statusCode: 404,
          message: `Service ${serviceName} for client ${clientId} does not present `,
        };
      }

      //now update client_service_settings table to enable webhook for this service
      const status = services[serviceName];

      await existingClientService.update({
        isStatusWebhookEnabled: status,
      });
      return;
    }

    return { success: true, message: "Webhook added successfully" };
  } catch (error) {
    throw error;
  }
}

async function updateWebhook(payload, webhookId, clientId) {
  try {
    const metadata = new grpc.Metadata();
    metadata.add("x-internal-key", process.env.INTERNAL_GRPC_KEY);

    // add webhookId in payload to send webhook service

    payload.webhookId = webhookId;

    //send  update webhook request by calling updateWebhook function in webhook service

    const { services } = await grpcHelper.updateWebhook(
      webhookGRPCClient,
      payload,
      metadata,
    );

    // if response comes success then update enabled services in db

    const dbConnect = await global.connectionManager.getModels(clientId);
    for (let serviceName of Object.keys(services)) {
      //get service name
      const existingService = await dbConnect.services.findOne({
        where: { name: serviceName },
      });
      if (!existingService) {
        throw {
          statusCode: 404,
          message: `Service ${serviceName} does not present`,
        };
      }
      //checking client service exist in client_service_settings table to update setting for webhook status
      const existingClientService = await dbConnect.ClientServiceSetting.find({
        where: {
          serviceId: existingService.id,
          clientId,
        },
      });
      if (!existingClientService) {
        throw {
          statusCode: 404,
          message: `Service ${serviceName} for client ${clientId} does not present `,
        };
      }
      //now update client_service_settings table to enable webhook for this service
      const status = services[serviceName];
      await existingClientService.update({
        isStatusWebhookEnabled: status,
      });
      return;
    }

    return { success: true, message: "Webhook updated successfully" };
  } catch (error) {
    throw error;
  }
}

async function deleteWebhook(webhookId, clientId) {
  try {
    const metadata = new grpc.Metadata();
    metadata.add("x-internal-key", process.env.INTERNAL_GRPC_KEY);

    // add webhookId in payload to send webhook service

    payload.webhookId = webhookId;

    //send delete request by calling deleteWebhook function in  webhook service

    await grpcHelper.deleteWebhook(webhookGRPCClient, payload, metadata);

    const dbConnect = await global.connectionManager.getModels(clientId);

    // if response comes success then add enabled services in db
    for (let serviceName of Object.keys(services)) {
      //get service name
      const existingService = await dbConnect.services.findOne({
        where: { name: serviceName },
      });
      if (!existingService) {
        throw {
          statusCode: 404,
          message: `Service ${serviceName} does not present`,
        };
      }

      //checking client service exist in client_service_settings table to update setting for webhook status
      const existingClientService = await dbConnect.ClientServiceSetting.find({
        where: {
          serviceId: existingService.id,
          clientId,
        },
      });
      if (!existingClientService) {
        throw {
          statusCode: 404,
          message: `Service ${serviceName} for client ${clientId} does not present `,
        };
      }
      //now update client_service_settings table to enable webhook for this service
      const status = services[serviceName];
      await existingClientService.update({
        isStatusWebhookEnabled: status,
      });
      return;
    }

    return { success: true, message: "Webhook deleted successfully" };
  } catch (error) {
    throw error;
  }
}

module.exports = { addWebhook, updateWebhook, deleteWebhook };
