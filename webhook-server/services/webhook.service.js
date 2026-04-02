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

    if (retryEnabled !== undefined) {
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
    const { clientId, query = {} } = payload;

    if (!clientId) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "Client id is required",
      });
    }

    const page = Math.max(Number.parseInt(query.page) || 1, 1);
    const limit = Math.min(Number.parseInt(query.limit) || 10, 100); // cap limit
    const skip = (page - 1) * limit;

    const sortOrderValue = query.order === "desc" ? -1 : 1;
    const allowedSortFields = ["createdAt", "updatedAt"];
    const sortField = allowedSortFields.includes(query.sort)
      ? query.sort
      : "createdAt";

    const response = {};

    const fieldsArr = query.fields ? query.fields.split(",") : [];

    const baseQuery = {
      clientId,
      deletedAt: null,
    };

    // CONFIGURATIONS
    if (!query.fields || fieldsArr.includes("configurations")) {
      const [data, totalItems] = await Promise.all([
        WebhookConfig.find(baseQuery)
          .select("-__v")
          .sort({ [sortField]: sortOrderValue })
          .skip(skip)
          .limit(limit)
          .lean(),

        WebhookConfig.countDocuments(baseQuery),
      ]);

      // decrypt + serialize
      const serialized = webhookConfigSerializer(
        data.map((conf) => ({
          ...conf,
          apiKey: decrypt(conf.apiKey),
        })),
      );

      response.configurations = serialized;

      // pagination
      response.pagination = {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasNextPage: page * limit < totalItems,
      };
    }

    // ENABLED SERVICES
    if (fieldsArr.includes("enabledServices")) {
      response.enabledServices =
        await findAllEnabledServicesForClient(clientId);
    }

    if (Object.keys(response).length === 0) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: "No webhook configuration found.",
      });
    }

    // FINAL RESPONSE
    return callback(null, {
      payload: JSON.stringify({
        success: true,
        message: "Webhook fetched successfully",
        data: response,
      }),
    });
  } catch (error) {
    logger.error(
      `Error in fetching all webhooks: ${JSON.stringify({
        error: error.message,
        stack: error.stack,
      })}`,
    );

    return callback({
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

    const page = Math.max(Number.parseInt(query.page) || 1, 1);
    const limit = Math.min(Number.parseInt(query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    const sortOrderValue = query.order === "desc" ? -1 : 1;
    const allowedSortFields = ["createdAt", "updatedAt"];
    const sortField = allowedSortFields.includes(query.sort)
      ? query.sort
      : "createdAt";

    const result = await WebhookCronScheduler.aggregate([
      // First collection match
      {
        $match: { clientId },
      },

      // Merge second collection
      {
        $unionWith: {
          coll: "webhooklogs", // collection name in MongoDB
          pipeline: [{ $match: { clientId } }],
        },
      },

      // Global sort
      {
        $sort: { [sortField]: sortOrderValue },
      },

      // Facet for pagination + total count
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: { __v: 0 },
            },
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    ]);

    const data = result[0].data;
    const totalItems = result[0].totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalItems / limit);

    callback(null, {
      payload: JSON.stringify({
        success: true,
        message: "Webhook logs fetched successfully",
        data: {
          data: webhookLogsSerializer(data),
          pagination: {
            page,
            limit,
            totalItems,
            totalPages,
            hasNextPage: page * limit < totalItems,
          },
        },
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
