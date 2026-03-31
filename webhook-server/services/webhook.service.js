const grpc = require("@grpc/grpc-js");
const logger = require("../utils/logger");
const WebhookConfig = require("../models/webhook");
const WebhookCronScheduler = require("../models/webhookCronSchedulerModel");
const WebhookLogs = require("../models/webhookLogsModel");
const {
  webhookConfigSerializer,
  webhookLogsSerializer,
} = require("../serializer");

const { encrypt, decrypt } = require("../utils/cryptoUtil");

const {
  isUniqueConstraintError,
  findAllEnabledServicesForClient,
} = require("../helpers/mongoose.helper");
const { isValidObjectId } = require("mongoose");

const addWebhook = async (call, callback) => {
  try {
    const callerKey = call.metadata.get("x-internal-key")[0];

    if (callerKey !== process.env.INTERNAL_GRPC_KEY) {
      logger.error(`GRPC call failed as, x-internal-key doesn't match`);
      return callback({
        code: grpc.status.PERMISSION_DENIED,
        message: `Unauthorized caller, x-internal-key doesn't match`,
      });
    }

    let payload = JSON.parse(call.request.payload);
    const {
      clientId,
      webhookUrl,
      apiKey,
      serviceTrigger,
      retryEnabled = true,
      isActive = true,
    } = payload;

    await WebhookConfig.create({
      clientId,
      webhookUrl,
      apiKey: encrypt(apiKey),
      retryEnabled,
      isActive,
      serviceTrigger,
      retryCount: Number.parseInt(process.env.MAX_RETRY_ATTEMPTS),
    });

    const services = await findAllEnabledServicesForClient(clientId);

    callback(null, {
      payload: JSON.stringify({
        success: true,
        message: "Webhook added successfully",
        services: services,
      }),
    });
  } catch (err) {
    logger.error(
      `Error in adding webhook configuration: ${JSON.stringify({ error: err.message, stack: err.stack })}`,
    );
    if (isUniqueConstraintError(err)) {
      return callback({
        code: 6,
        message: "Configuration already exists.",
      });
    }
    callback({
      code: grpc.status.INTERNAL,
      message: "Internal server error",
    });
  }
};

const updateWebhook = async (call, callback) => {
  try {
    const callerKey = call.metadata.get("x-internal-key")[0];

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
      retryEnabled,
      retryCount,
    } = payload;

    if (!webhookId || !clientId) {
      logger.info(`Webhook id and client id is required`);
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "Webhook id and client id is required",
      });
    }

    if (!isValidObjectId(webhookId)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: `no webhook config found with id ${webhookId}`,
      });
    }

    const setFields = {};
    const addToSetFields = {};

    // webhook fields
    if (webhookUrl) {
      setFields.webhookUrl = webhookUrl;
    }

    if (apiKey) {
      setFields.apiKey = encrypt(apiKey);
    }

    if (isActive !== undefined) {
      setFields.isActive = isActive;
    }

    if (retryEnabled) {
      setFields.retryEnabled = retryEnabled;
    }

    if (retryCount) {
      setFields.retryCount = retryCount;
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
    const result = await WebhookConfig.findOneAndUpdate(
      {
        _id: webhookId,
        clientId: clientId,
        deletedAt: null,
      },
      updateQuery,
    );

    if (!result) {
      throw {
        statusCode: grpc.status.NOT_FOUND,
        message: "no webhook config found",
      };
    }
    logger.info(
      `Webhook configuration for client has beed updated successfully`,
    );

    const services = await findAllEnabledServicesForClient(clientId);

    callback(null, {
      payload: JSON.stringify({
        success: true,
        message: "Webhook updated successfully",
        services,
      }),
    });
  } catch (error) {
    logger.error(
      `Error in updating webhook configuration: ${JSON.stringify({ error: error.message, stack: error.stack })}`,
    );
    if (isUniqueConstraintError(error)) {
      return callback({
        code: grpc.status.ALREADY_EXISTS,
        message: "Configuration already exists.",
      });
    }
    callback({
      code: error.statusCode || grpc.status.INTERNAL,
      message: error.message || "Internal server error",
    });
  }
};

const deleteWebhook = async (call, callback) => {
  try {
    const callerKey = call.metadata.get("x-internal-key")[0];

    if (callerKey !== process.env.INTERNAL_GRPC_KEY) {
      return callback({
        code: grpc.status.PERMISSION_DENIED,
        message: "Unauthorized caller",
      });
    }

    const payload = JSON.parse(call.request.payload);
    const { clientId, webhookId } = payload;

    if (!clientId || !webhookId) {
      logger.info(`Client id and webhookId id is required`);
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "Client id and webhookId id is required",
      });
    }

    if (!isValidObjectId(webhookId)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: `no webhook config found with id ${webhookId}`,
      });
    }
    const config = await WebhookConfig.findOneAndUpdate(
      {
        _id: webhookId,
        deletedAt: null,
      },
      { deletedAt: new Date() },
    );

    if (!config) {
      throw { statusCode: grpc.status.NOT_FOUND, message: "no config found." };
    }

    const services = await findAllEnabledServicesForClient(clientId);
    callback(null, {
      payload: JSON.stringify({
        success: true,
        message: "Webhook deleted successfully",
        services,
      }),
    });
  } catch (error) {
    logger.error(
      `Error in deleting webhook: ${JSON.stringify({ error: error.message, stack: error.stack })}`,
    );
    callback({
      code: error.statusCode || grpc.status.INTERNAL,
      message: error.message || "Internal server error",
    });
  }
};

const allWebhook = async (call, callback) => {
  try {
    const callerKey = call.metadata.get("x-internal-key")[0];

    if (callerKey !== process.env.INTERNAL_GRPC_KEY) {
      return callback({
        code: grpc.status.PERMISSION_DENIED,
        message: "Unauthorized caller",
      });
    }

    const payload = JSON.parse(call.request.payload);
    const { clientId, query } = payload;

    if (!clientId) {
      logger.info(`Client id is required`);
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "Client id is required",
      });
    }

    // destructure query params
    const { fields, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    // response body
    const response = {};

    if (fields) {
      const fieldsArr = fields.split(",");

      if (fieldsArr.includes("configurations")) {
        response["configurations"] = await WebhookConfig.find({
          clientId,
          deletedAt: null,
        })
          .select("-__v")
          .skip(skip)
          .limit(limit)
          .lean();
      }

      if (fieldsArr.includes("enabledServices")) {
        response["enabledServices"] =
          await findAllEnabledServicesForClient(clientId);
      }
    } else {
      response["configurations"] = await WebhookConfig.find({
        clientId,
        deletedAt: null,
      })
        .select("-__v")
        .skip(skip)
        .limit(limit)
        .lean();
    }

    if (Object.keys(response).length === 0) {
      throw {
        statusCode: grpc.status.NOT_FOUND,
        message: "no webhook configuration found.",
      };
    }

    // serialize config
    response["configurations"] = webhookConfigSerializer(
      response.configurations.map((conf) => {
        const t = { ...conf, apiKey: decrypt(conf.apiKey) };
        return t;
      }),
    );

    callback(null, {
      payload: JSON.stringify({
        success: true,
        message: "Webhook fetched successfully",
        data: response,
      }),
    });
  } catch (error) {
    logger.error(
      `Error in fetching all webhooks: ${JSON.stringify({ error: error.message, stack: error.stack })}`,
    );
    callback({
      code: error.statusCode || grpc.status.INTERNAL,
      message: error.message || "Internal server error",
    });
  }
};

const getAllWebhookLogs = async (call, callback) => {
  try {
    const callerKey = call.metadata.get("x-internal-key")[0];

    if (callerKey !== process.env.INTERNAL_GRPC_KEY) {
      return callback({
        code: grpc.status.PERMISSION_DENIED,
        message: "Unauthorized caller",
      });
    }

    const payload = JSON.parse(call.request.payload);
    const { clientId, query } = payload;

    if (!clientId) {
      logger.info(`Client id is required`);
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "Client id is required",
      });
    }

    // destructure query params
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    // fetch all logs
    const schedulerLogs = await WebhookCronScheduler.find({
      clientId,
    })
      .select("-__v")
      .skip(skip)
      .limit(limit)
      .lean();
    const completedLogs = await WebhookLogs.find({ clientId })
      .select("-__v")
      .skip(skip)
      .limit(limit)
      .lean();

    callback(null, {
      payload: JSON.stringify({
        success: true,
        message: "Webhook logs fetched successfully",
        data: webhookLogsSerializer([...schedulerLogs, ...completedLogs]),
      }),
    });
  } catch (error) {
    logger.error(
      `Error in fetching webhook logs: ${JSON.stringify({ error: error.message, stack: error.stack })}`,
    );
    callback({
      code: error.statusCode || grpc.status.INTERNAL,
      message: error.message || "Internal server error",
    });
  }
};

module.exports = {
  addWebhook,
  allWebhook,
  updateWebhook,
  deleteWebhook,
  getAllWebhookLogs,
};
