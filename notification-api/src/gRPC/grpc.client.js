const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");

const PROTO_PATH = path.join(__dirname, "../../proto/sms.proto");

const packageDef = protoLoader.loadSync(PROTO_PATH);
const grpcObj = grpc.loadPackageDefinition(packageDef);
const smsPackage = grpcObj.sms;

const client = new smsPackage.SmsService(
  `${process.env.GRPC_URL}:${process.env.GRPC_PORT}`,
  grpc.credentials.createInsecure(),
);

module.exports = client;
