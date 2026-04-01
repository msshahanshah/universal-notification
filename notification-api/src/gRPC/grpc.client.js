const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const logger = require('../logger');

const PROTO_PATH = path.join(__dirname, '../../proto/sms.proto');

let client = null;
const GRPC_PORT = process.env.GRPC_PORT;
const GRPC_URL = process.env.GRPC_URL;
if (!GRPC_PORT || !GRPC_URL) {
  logger.warn('missing grpc port and url');
} else {
  const packageDef = protoLoader.loadSync(PROTO_PATH);
  const grpcObj = grpc.loadPackageDefinition(packageDef);
  const smsPackage = grpcObj.sms;

  client = new smsPackage.SmsService(`${process.env.GRPC_URL}:${process.env.GRPC_PORT}`, grpc.credentials.createInsecure());
}

module.exports = client;
