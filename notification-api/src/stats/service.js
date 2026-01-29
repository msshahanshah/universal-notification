const viewBalance = async (clientId, service, provider) => {

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

module.exports = viewBalance