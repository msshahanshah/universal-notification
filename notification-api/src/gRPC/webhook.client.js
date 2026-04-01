const grpc = require('@grpc/grpc-js'); //to use grpc we need this library
const protoLoader = require('@grpc/proto-loader'); //Reads .proto file and converts it into JavaScript object
const path = require('path');
const webhookProtoFilePath = path.join(__dirname, '../../proto/webhook.proto');
const logger = require('../logger');

let webhookGRPCClient = null;
const GRPC_URL_WEBHOOK = process.env.GRPC_URL_WEBHOOK;

if (!GRPC_URL_WEBHOOK) {
  logger.warn(`GRPC url is missing`);
} else {
  const packageDef = protoLoader.loadSync(webhookProtoFilePath);
  const grpcObj = grpc.loadPackageDefinition(packageDef);

  const webhookPackage = grpcObj.webhook;
  webhookGRPCClient = new webhookPackage.WebhookService(GRPC_URL_WEBHOOK, grpc.credentials.createInsecure());

  const metadata = new grpc.Metadata();
  metadata.add('x-internal-key', process.env.INTERNAL_GRPC_KEY);
}

module.exports = webhookGRPCClient;
