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
  findAllEnabledServicesForClient,
} = require("../helpers/mongoose.helper");

const { isValidObjectId } = require("mongoose");
const {
  assertInternalCaller,
  handleError,
} = require("../helpers/webhook.helper");

const addWebhook = async (call, callback) => {
  try {
    /** Verify  Caller */
    if (!assertInternalCaller(call, callback)) return;

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
  } catch (error) {
    handleError("Error in adding webhook configuration", error, callback);
  }
};

const updateWebhook = async (call, callback) => {
  try {
    /** Verify  Caller */
    if (!assertInternalCaller(call, callback)) return;

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
    handleError("Error in updating webhook configuration", error, callback);
  }
};

const deleteWebhook = async (call, callback) => {
  try {
    /** Verify  Caller */
    if (!assertInternalCaller(call, callback)) return;

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
    handleError("Error in deleting webhook", error, callback);
  }
};

const allWebhook = async (call, callback) => {
  try {
    /** Verify  Caller */
    if (!assertInternalCaller(call, callback)) return;

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
    const {
      fields,
      page = 1,
      limit = 10,
      sort = "updatedAt",
      order = "desc",
    } = query;

    const skip = (page - 1) * limit;
    const sortOrderValue = order === "desc" ? -1 : 1;
    const allowedSortFields = ["createdAt", "updatedAt"];
    const sortField = allowedSortFields.includes(sort) ? sort : "createdAt";
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
          .sort({ [sortField]: sortOrderValue })
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
        .sort({ [sortField]: sortOrderValue })
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
    handleError("Error in fetching all webhooks", error, callback);
  }
};

const getAllWebhookLogs = async (call, callback) => {
  try {
    /** Verify  Caller */
    if (!assertInternalCaller(call, callback)) return;

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
    const { page = 1, limit = 10, sort = "createdAt", order = "desc" } = query;
    const skip = (page - 1) * limit;
    const allowedSortFields = ["createdAt", "updatedAt"];
    const sortField = allowedSortFields.includes(sort) ? sort : "createdAt";
    const sortOrderValue = order === "desc" ? -1 : 1;

    // fetch all logs
    const schedulerLogs = await WebhookCronScheduler.find({
      clientId,
    })
      .select("-__v")
      .sort({ [sortField]: sortOrderValue })
      .skip(skip)
      .limit(limit)
      .lean();
    const completedLogs = await WebhookLogs.find({ clientId })
      .select("-__v")
      .sort({ [sortField]: sortOrderValue })
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
    handleError("Error in fetching webhook logs", error, callback);
  }
};

module.exports = {
  addWebhook,
  allWebhook,
  updateWebhook,
  deleteWebhook,
  getAllWebhookLogs,
};
