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
    webhookGRPCClient.addWebhook(
      { payload: JSON.stringify(payload) },
      metadata,
      (error, response) => {
        if (error) {
          console.log(error);
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
    webhookGRPCClient.updateWebhook(
      { payload: JSON.stringify(payload) },
      metadata,
      (error, response) => {
        if (error) {
          console.log(error);
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
    webhookGRPCClient.deleteWebhook(
      { payload: JSON.stringify(payload) },
      metadata,
      (error, response) => {
        if (error) {
          console.log(error);
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
};
