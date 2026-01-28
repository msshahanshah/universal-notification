const grpcClient = require("../gRPC/grpc.client");
const grpc = require('@grpc/grpc-js');

const getBalance = async (req, res) => {
    try {
        const clientId = req.headers["x-client-id"];
        const { provider } = req.query;

        const metadata = new grpc.Metadata();
        metadata.add("x-internal-key", process.env.INTERNAL_GRPC_KEY);
        
        grpcClient.GetBalance({ clientId, provider: provider ? provider.toUpperCase() : undefined }, metadata, (err, response) => {
            if (err) {
                console.error("gRPC error:", err);
                return res.status(+err.metadata?.get("error-code")?.[0] || 500).json({
                    success: false, 
                    message: err.metadata?.get("message")?.[0] || err.message
                });
            }
            return res.json({
                success: true,
                message: "Balance fetched successfully",
                data: {
                    provider: response.provider,
                    label: "Amount",
                    balance: response.balance,
                    currency: response.currency
                }
            });
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getBalance };
