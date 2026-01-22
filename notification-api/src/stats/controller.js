const { status } = require("@grpc/grpc-js");
const grpcClient = require("../gRPC/grpc.client");

const getBalance = async (req, res) => {
    try {
        const clientId = req.headers["x-client-id"];

        grpcClient.GetBalance({ clientId }, (err, response) => {
            if (err) {
                console.error("gRPC error:", err);
                return res.status(500).json({ status: false, message: err.message });
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
        return res.status(500).json({ error: error.message });
    }
};

module.exports = { getBalance };
