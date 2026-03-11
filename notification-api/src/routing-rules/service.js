const createRoutingRule = async (clientId, payload) => {
    const { service, provider, matchKey, matchValue } = payload;

    const dbConnect = await global.connectionManager.getModels(clientId);

    serviceName = service.toUpperCase();
    const routingRuleExist = await dbConnect.RoutingRule.findOne({
        where: { service: serviceName, match_value: matchValue }
    });

    if (routingRuleExist) {
        throw {
            statusCode: 409,
            message: "Routing rule is already exists."
        }
    }
    const routingRule = await dbConnect.RoutingRule.create({
        service: serviceName,
        provider,
        match_key: matchKey,
        match_value: matchValue
    });
    const result = routingRule.get({ plain: true });
    delete result.deletedAt;

    return result;
}

module.exports = createRoutingRule;