const logger = require("../src/logger");

const grpcCodeToHttpStatusCode = {
  0: 200, // OK
  1: 499, // CANCELLED
  2: 500, // UNKNOWN
  3: 400, // INVALID_ARGUMENT
  4: 504, // DEADLINE_EXCEEDED
  5: 404, // NOT_FOUND
  6: 409, // ALREADY_EXISTS
  7: 403, // PERMISSION_DENIED
  8: 429, // RESOURCE_EXHAUSTED
  9: 400, // FAILED_PRECONDITION
  10: 409, // ABORTED
  11: 400, // OUT_OF_RANGE
  12: 501, // UNIMPLEMENTED
  13: 500, // INTERNAL
  14: 503, // UNAVAILABLE
  15: 500, // DATA_LOSS
  16: 401, // UNAUTHENTICATED
};

//ADD WEBHOOK
function addWebhook(webhookGRPCClient, payload, metadata) {
  return new Promise((resolve, reject) => {
    webhookGRPCClient.AddWebhookConfig(
      { payload: JSON.stringify(payload) },
      metadata,
      (error, response) => {
        if (error) {
          logger.error(
            `Error in adding webhook config to mongo ${error.message}`,
          );
          error = {
            statusCode: grpcCodeToHttpStatusCode[error.code],
            message: error.details,
          };

          return reject(error);
        }

        resolve(JSON.parse(response.payload));
      },
    );
  });
}

//UPDATE WEBHOOK
function updateWebhook(webhookGRPCClient, payload, metadata) {
  return new Promise((resolve, reject) => {
    webhookGRPCClient.updateWebhookConfig(
      { payload: JSON.stringify(payload) },
      metadata,
      (error, response) => {
        if (error) {
          logger.error(
            `Error in updating webhook config to mongo ${error.message}`,
          );
          error = {
            statusCode: grpcCodeToHttpStatusCode[error.code],
            message: error.details,
          };

          return reject(error);
        }
        resolve(JSON.parse(response.payload));
      },
    );
  });
}

//DELETE WEBHOOK
function deleteWebhook(webhookGRPCClient, payload, metadata) {
  return new Promise((resolve, reject) => {
    webhookGRPCClient.deleteWebhookConfig(
      { payload: JSON.stringify(payload) },
      metadata,
      (error, response) => {
        if (error) {
          logger.error(
            `Error in deleting webhook config to mongo ${error.message}`,
          );
          error = {
            statusCode: grpcCodeToHttpStatusCode[error.code],
            message: error.details,
          };

          return reject(error);
        }
        resolve(JSON.parse(response.payload));
      },
    );
  });
}

//ALL WEBHOOK
function getWebhooks(webhookGRPCClient, payload, metadata) {
  return new Promise((resolve, reject) => {
    webhookGRPCClient.AllWebhookConfig(
      { payload: JSON.stringify(payload) },
      metadata,
      (error, response) => {
        if (error) {
          logger.error(
            `Error in fetching webhook config from mongo ${error.message}`,
          );
          error = {
            statusCode: grpcCodeToHttpStatusCode[error.code],
            message: error.details,
          };

          return reject(error);
        }
        resolve(JSON.parse(response.payload));
      },
    );
  });
}

function getWebhookLogs(webhookGRPCClient, payload, metadata) {
  return new Promise((resolve, reject) => {
    webhookGRPCClient.GetAllWebhookLogs(
      { payload: JSON.stringify(payload) },
      metadata,
      (error, response) => {
        if (error) {
          logger.error(
            `Error in fetching webhook logs from mongo ${error.message}`,
          );
          error = {
            statusCode: grpcCodeToHttpStatusCode[error.code],
            message: error.details,
          };

          return reject(error);
        }
        resolve(JSON.parse(response.payload));
      },
    );
  });
}

module.exports = {
  addWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhooks,
  getWebhookLogs,
};
