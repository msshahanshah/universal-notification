const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require("path");

const SmsSender = require('../utillity/smsSender');
const { loadClientConfigs } = require('../utillity/loadClientConfigs');
const logger = require('../logger');

const PROTO_PATH = path.join(__dirname, "../../proto/sms.proto");
// load proto
const packageDef = protoLoader.loadSync(PROTO_PATH);
const grpcObj = grpc.loadPackageDefinition(packageDef);
const smsPackage = grpcObj.sms;

async function GetBalance(call, callback) {
    try {
        const metadata = call.metadata;
        const callerKey = metadata.get("x-internal-key")?.[0];

        if (callerKey !== process.env.INTERNAL_GRPC_KEY) {
            const errorMeta = new grpc.Metadata();
            errorMeta.add("error-code", 401);
            errorMeta.add("message", "Unauthorized");
            return callback({
                code: grpc.status.PERMISSION_DENIED,
                message: "Unauthorized caller",
                metadata: errorMeta
            });
        }

        const clientId = call.request.clientId;
        const provider = call.request.provider

        const clientList = await loadClientConfigs();
        const smsConfig = clientList.find(c => c.ID === clientId)?.SMS;

        if (!smsConfig) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: "SMS config not found"
            });
        }
        const smsSender = new SmsSender(smsConfig, provider);
        await smsSender.initialize();

        const balance = await smsSender.stat();

        callback(null, {
            provider: smsSender.provider,
            balance: balance.balance,
            currency: balance?.currency
        });
        
    } catch (error) {
        callback({
            code: grpc.status.INTERNAL,
            message: error.message
        });
    }
}


function startServer() {
    const server = new grpc.Server();
    server.addService(smsPackage.SmsService.service, { GetBalance });
    server.bindAsync(`${process.env.GRPC_URL}:${process.env.GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), () => {
        logger.info(`gRPC SMS Server running on port ${process.env.GRPC_PORT}`);
        server.start();
    });
}

startServer();
