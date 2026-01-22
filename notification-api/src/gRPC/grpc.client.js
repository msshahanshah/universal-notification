const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");

const PROTO_PATH = path.join(__dirname, "../../proto/sms.proto");

const packageDef = protoLoader.loadSync(PROTO_PATH);
const grpcObj = grpc.loadPackageDefinition(packageDef);
const smsPackage = grpcObj.sms;

const client = new smsPackage.SmsService(
    "localhost:6000",
    grpc.credentials.createInsecure()
);

module.exports = client;
