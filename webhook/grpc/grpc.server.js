const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const logger = require('../utils/logger');
const WebhookConfig = require('../models/webhook');
const { encrypt } = require('../utils/cryptoUtil');
const mongoose = require('mongoose');

const PROTO_PATH = path.join(__dirname, '../webhook.proto');

const addWebhook = async (call, callback) => {
  try {
    const callerKey = call.metadata.get('x-internal-key')[0];

    if (callerKey !== process.env.INTERNAL_GRPC_KEY) {
      logger.error(`GRPC call failed as, x-internal-key doesn't match`);
      return callback({
        code: grpc.status.PERMISSION_DENIED,
        message: `Unauthorized caller, x-internal-key doesn't match`,
      });
    }

    let payload = JSON.parse(call.request.payload);

    payload = Array.isArray(payload) ? payload : [payload];
    const serviceObj = {};

    const object = payload.map((doc) => {
      const { clientId, webhookUrl, apiKey, serviceTrigger } = doc;
      const { retryEnabled, isActive } = doc;
      if (!clientId || !webhookUrl || !apiKey || !serviceTrigger) {
        return 'not valid';
      }
      for (let objKey in doc.serviceTrigger) {
        if (doc.serviceTrigger[objKey].length !== 0) serviceObj[objKey] = 1;
        else serviceObj[objKey] = 0;
      }

      return {
        clientId: clientId,
        webhookUrl: webhookUrl,
        encryptedKey: encrypt(apiKey, 'key'),
        retryEnabled: retryEnabled || false,
        isActive: isActive || false,
        serviceTrigger: serviceTrigger,
        retryCount: Number.parseInt(process.env.MAX_RETRY_ATTEMPTS),
      };
    });

    for (const item of object) {
      if (item === 'not valid') {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Please provide clientId, webhookUrl, key, serviceTrigger',
        });
      }
    }

    await WebhookConfig.insertMany(object);

    const services = {};

    for (let keys in serviceObj) {
      if (serviceObj[keys] === 1) {
        services[keys] = true;
      } else {
        services[keys] = false;
      }
    }

    callback(null, {
      payload: JSON.stringify({
        success: true,
        message: 'Webhook added successfully',
        services: services,
      }),
    });
  } catch (err) {
    logger.error(`Error in adding webhook configuration ${err.message}`);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error',
    });
  }
};

const updateWebhook = async (call, callback) => {
  try {
    const callerKey = call.metadata.get('x-internal-key')[0];

    if (callerKey !== process.env.INTERNAL_GRPC_KEY) {
      logger.error(`GRPC call failed as, x-internal-key doesn't match`);
      return callback({
        code: grpc.status.PERMISSION_DENIED,
        message: `Unauthorized caller, x-internal-key doesn't match`,
      });
    }

    const payload = JSON.parse(call.request.payload);

    const {
      webhookUrl,
      apiKey,
      isActive,
      serviceTrigger,
      webhookId,
      clientId,
    } = payload;

    if (!webhookId || !clientId) {
      logger.info(`Webhook id and client id is required`);
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Webhook id and client id is required',
      });
    }

    // Expected req body ---

    //    {
    //   "webhookUrl": "webhookUrl1",
    //   "clientId": "client-id"
    //   "serviceTrigger": {
    //     "email": ["success"],
    //     "slack": ["success"],
    //.     "sms": ["success"] , "sms": ["failed"] == >> "sms": ["success", "failed"]
    //   },
    //   "apiKey": "API-Key",
    //   "isActive": true,
    // webhookId:webhook-id
    //   }

    const setFields = {};
    const addToSetFields = {};

    // webhook fields
    if (webhookUrl) {
      setFields.webhookUrl = webhookUrl;
    }

    if (apiKey) {
      setFields.apiKey = encrypt(apiKey, 'abc');
    }

    if (isActive !== undefined) {
      setFields.isActive = isActive;
    }

    // serviceTrigger logic
    if (serviceTrigger) {
      for (const service in serviceTrigger) {
        const triggers = serviceTrigger[service];

        if (triggers.length === 0) {
          setFields[`serviceTrigger.${service}`] = [];
        } else {
          addToSetFields[`serviceTrigger.${service}`] = {
            $each: triggers,
          };
        }
      }
    }

    // build final mongo update query
    const updateQuery = {};

    if (Object.keys(setFields).length) {
      updateQuery.$set = setFields;
    }

    if (Object.keys(addToSetFields).length) {
      updateQuery.$addToSet = addToSetFields;
    }

    // mongo update
    const result = await WebhookConfig.updateOne(
      {
        _id: mongoose.Types.ObjectId.createFromHexString(webhookId),
        clientId: clientId,
      },
      updateQuery,
    );

    if (result.matchedCount === 0) {
      logger.info(`No webhook found with id - ${webhookId}`);
      return callback({
        code: grpc.status.PERMISSION_DENIED,
        message: 'Permission denied to perform action',
      });
    }
    logger.info(
      `Webhook configuration for client has beed updated successfully`,
    );

    const services = {};
    if (payload.serviceTrigger) {
      Object.entries(payload.serviceTrigger).forEach(([key, value]) => {
        services[key] = value.length > 0;
      });
    }

    if (!Object.keys(updateQuery).length) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'No fields to update',
      });
    }

    callback(null, {
      payload: JSON.stringify({
        success: true,
        message: 'Webhook updated successfully',
        services,
      }),
    });
  } catch (err) {
    logger.error(`Error ${err}`);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error',
    });
  }
};

const deleteWebhook = async (call, callback) => {
  try {
    const callerKey = call.metadata.get('x-internal-key')[0];

    if (callerKey !== process.env.INTERNAL_GRPC_KEY) {
      return callback({
        code: grpc.status.PERMISSION_DENIED,
        message: 'Unauthorized caller',
      });
    }

    const payload = JSON.parse(call.request.payload);
    const { clientId, webhookId } = payload;

    if (!clientId || !webhookId) {
      logger.info(`Client id and webhookId id is required`);
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Client id and webhookId id is required',
      });
    }

    // payload expected ---
    // {
    //     "clientId": "...",
    //     "webhookId": "..."
    // }

    // Delete webhook logic

    const requiredWebhook = await WebhookConfig.find({
      _id: mongoose.Types.ObjectId.createFromHexString(webhookId),
      clientId,
    }).lean();

    if (requiredWebhook.length === 0) {
      logger.info(
        `No webhook document found for client - ${clientId} with id - ${webhookId}`,
      );
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Webhook document not found',
      });
    }

    const services = {};

    Object.keys(requiredWebhook[0]?.serviceTrigger).forEach((service) => {
      services[`${service}`] = false;
    });

    const result = await WebhookConfig.deleteOne({
      _id: mongoose.Types.ObjectId.createFromHexString(webhookId),
      clientId,
    });

    callback(null, {
      payload: JSON.stringify({
        success: true,
        message: 'Webhook deleted successfully',
        services,
      }),
    });
  } catch (error) {
    logger.error(`Error: ${error}`);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error',
    });
  }
};

const allWebhook = async (call, callback) => {
  try {
    const callerKey = call.metadata.get('x-internal-key')[0];

    if (callerKey !== process.env.INTERNAL_GRPC_KEY) {
      return callback({
        code: grpc.status.PERMISSION_DENIED,
        message: 'Unauthorized caller',
      });
    }

    const payload = JSON.parse(call.request.payload);
    const { clientId } = payload;

    if (!clientId) {
      logger.info(`Client id is required`);
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Client id is required',
      });
    }

    // payload expected ---
    // {
    //     "clientId": "...",
    // }

    // List webhook logic

    const allWebhooks = await WebhookConfig.find({
      clientId,
    }).lean();

    if (allWebhooks.length === 0) {
      logger.info(
        `No webhook document found for client - ${clientId} with id - ${webhookId}`,
      );
    }

    callback(null, {
      payload: JSON.stringify({
        success: true,
        message: 'Webhook fetched successfully',
        data: allWebhooks,
      }),
    });
  } catch (error) {
    logger.error(`Error: ${error}`);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error',
    });
  }
};

const startGrpcServer = () => {
  try {
    const packageDef = protoLoader.loadSync(PROTO_PATH);
    const grpcObj = grpc.loadPackageDefinition(packageDef);

    const webhookPackage = grpcObj.webhook;

    const server = new grpc.Server();

    server.addService(webhookPackage.WebhookService.service, {
      AddWebhookConfig: addWebhook,
      UpdateWebhookConfig: updateWebhook,
      DeleteWebhookConfig: deleteWebhook,
      AllWebhookConfig: allWebhook
    });

    const GRPC_HOST = process.env.GRPC_HOST;
    const GRPC_PORT = process.env.GRPC_PORT;

    server.bindAsync(
      `${GRPC_HOST}:${GRPC_PORT}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) {
          logger.error(`Failed to bind gRPC server: ${err.message}`);
          return;
        }

        logger.info(`Webhook gRPC server running on ${GRPC_HOST}:${port}`);
      },
    );
  } catch (err) {
    logger.error(`Failed to start GRPC server ${err}`);
  }
};

module.exports = { startGrpcServer };
