const fetchBalance = async (clientId, service, provider) => {

    if (!clientId || !service || !provider) {
        throw {
            statusCode: 400,
            message: "service or provider is missing"
        };
    }

    const dbConnect = await global.connectionManager.getModels(clientId);

    const balance = await dbConnect.Wallet.findOne({
        where: { code: clientId, service, provider },
    });

    if (!balance) {
        throw {
            statusCode: 404,    
            message: "Provider Not Found"
        }
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