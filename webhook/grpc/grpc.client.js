const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");

const PROTO_PATH = path.join(__dirname, "../webhook.proto");

const packageDef = protoLoader.loadSync(PROTO_PATH);
const grpcObj = grpc.loadPackageDefinition(packageDef);
const webhookPackage = grpcObj.webhook;

const client = new webhookPackage.WebhookService(
    `${process.env.GRPC_URL}:${process.env.GRPC_PORT}`,
    grpc.credentials.createInsecure(),
);

module.exports = client;