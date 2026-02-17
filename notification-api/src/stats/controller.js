const grpcClient = require("../gRPC/grpc.client");
const grpc = require('@grpc/grpc-js');
const { fetchBalance, updateBalance } = require("./service")

const labelMap = {
    TWILIO: "Amount",
    FAST2SMS: "Credits",
    MSG91: "Wallet Amount",
    DEFAULT: "Amount"
};

const getBalance = async (req, res) => {
    try {
        const clientId = req.headers["x-client-id"];
        const { service, provider } = req.query;

        if (!service || !provider) {
            throw { message: "service and provider are missing", statusCode: 400 };
        }

        const metadata = new grpc.Metadata();
        metadata.add("x-internal-key", process.env.INTERNAL_GRPC_KEY);

        grpcClient.GetBalance({ clientId, provider: provider ? provider.toUpperCase() : undefined }, metadata, async (err, response) => {
            if (err) {
                console.error("gRPC error:", err);
                return res.status(+err.metadata?.get("error-code")?.[0] || 500).json({
                    success: false,
                    message: err.metadata?.get("message")?.[0] || err.message
                });
            }

            const prov = response.provider?.toUpperCase();
            const label = labelMap[prov] || labelMap.DEFAULT;

            await updateBalance(clientId, response, label, service.toUpperCase());

            return res.json({
                success: true,
                message: "Balance fetched successfully",
                data: {
                    provider: response.provider,
                    label,
                    balance: response.balance,
                    currency: response?.currency
                }
            });
        });

    } catch (error) {
        return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

const viewBalance = async (req, res) => {
    try {
        const clientId = req.headers["x-client-id"];
        const { service, provider } = req.query;

        if (!service || !provider) {
            throw { message: "service and provider are missing", statusCode: 400 };
        }

        const response = await fetchBalance(clientId, service.toUpperCase(), provider.toUpperCase());

        return res.json({
            success: true,
            message: "Balance fetched successfully",
            data: {
                provider: response.provider,
                label: response.balance_type,
                balance: response.balance,
                currency: response.currency
            }
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({ success: false, message: error.message })
    }
}

module.exports = { getBalance, viewBalance };
