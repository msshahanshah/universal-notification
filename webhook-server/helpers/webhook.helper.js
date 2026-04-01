const logger = require("../utils/logger");
const { isUniqueConstraintError } = require("./mongoose.helper");

const assertInternalCaller = (call, callback) => {
  const callerKey = call.metadata.get("x-internal-key")[0];

  if (callerKey !== process.env.INTERNAL_GRPC_KEY) {
    callback({
      code: grpc.status.PERMISSION_DENIED,
      message: "Unauthorized caller",
    });
    return false;
  }

  return true;
};

const handleError = (msg, error, callback) => {
  logger.error(`${msg}: ${JSON.stringify(error)}`);
  if (isUniqueConstraintError(err)) {
    return callback({
      code: 6,
      message: "Configuration already exists.",
    });
  }
  callback({
    code: error.statusCode || grpc.status.INTERNAL,
    message: error.message || "Internal server error",
  });
};

module.exports = {
  assertInternalCaller,
  handleError,
};
