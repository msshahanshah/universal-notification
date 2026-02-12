const fetchBalance = async (clientId, service, provider) => {

    if (!clientId || !service || !provider) {
        throw { message: "service and provider are missing", statusCode: 400 };
    }

    const dbConnect = await global.connectionManager.getModels(clientId);

    const balance = await dbConnect.Wallet.findOne({
        where: { code: clientId, service, provider },
    });

    if (!balance) {
        const error = new Error("Provider Not Found");
        error.status = 404;
        throw error;
    }

    return balance;
}

const updateBalance = async (clientId, response, label, service) => {

    if (!clientId || !response?.provider || !service) {
        throw { message: "service and provider are missing", statusCode: 400 };
    }
    const dbConnect = await global.connectionManager.getModels(clientId);
    
    await dbConnect.Wallet.upsert({
        code: clientId,
        service,
        provider: response?.provider,
        balance: response.balance,
        balance_type: label,
        currency: response?.currency
    });
}
module.exports = { fetchBalance, updateBalance }