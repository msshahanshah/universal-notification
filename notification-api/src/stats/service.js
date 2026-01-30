const fetchBalance = async (clientId, service, provider) => {

    if (!clientId || !service || !provider) {
        throw new Error("clientId, service and provider are required");
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
        const err = new Error("clientId, service, provider are required");
        err.status = 400;
        throw err;
    }
    const dbConnect = await global.connectionManager.getModels(clientId);

    await dbConnect.Wallet.upsert({
        code: clientId,
        service,
        provider: response.provider,
        balance: response.balance,
        balance_type: label,
        currency: response?.currency 
    });
}
module.exports = { fetchBalance, updateBalance }