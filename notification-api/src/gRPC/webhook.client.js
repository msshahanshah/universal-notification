const grpc = require("@grpc/grpc-js"); //to use grpc we need this library
const protoLoader = require("@grpc/proto-loader"); //Reads .proto file and converts it into JavaScript object
const path = require("path");
const webhookProtoFilePath = path.join(__dirname, "../../proto/webhook.proto");
let webhookGRPCClient = null;

async function connectWebhookGRPCClient() {
  try {
    const packageDef = protoLoader.loadSync(webhookProtoFilePath); // converting webhook proto into js readable
    const grpcObj = grpc.loadPackageDefinition(packageDef); // the proto definition becomes a JavaScript object.

    const webhookPackage = grpcObj.webhook;

    const GRPC_URL = process.env.GRPC_URL;
    //creating a client that connect to grpc server in webhook service
    webhookGRPCClient = new webhookPackage.WebhookService(
      GRPC_URL,
      grpc.credentials.createInsecure(),
    );
  } catch (error) {
    console.log(
      "Failed to connect client to grpc server in webhook service ",
      error,
    );
  }
}
connectWebhookGRPCClient();

module.exports = webhookGRPCClient;
