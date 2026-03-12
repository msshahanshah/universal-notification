const createRoutingRule = async (clientId, payload) => {
    const { service, provider, matchKey, matchValue } = payload;

    const dbConnect = await global.connectionManager.getModels(clientId);

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
        service: service.toUpperCase(),
        provider,
        match_key: matchKey,
        match_value: matchValue
    });
    const result = routingRule.get({ plain: true });
    delete result.deletedAt;

    return result;
}

const removeRoutingRule = async (clientId, ruleId) => {
    const dbConnect = await global.connectionManager.getModels(clientId);

    const routingRuleExist = await dbConnect.RoutingRule.findOne({
        where: { id: ruleId }
    });

    if (!routingRuleExist) {
        throw {
            statusCode: 404,
            message: "Routing rule not found"
        }
    }

    await routingRuleExist.destroy();
}

const getRoutingRules = async (clientId, queryParams = {}) => {
    const {
        page = 1,
        limit = 10,
        service = null,
        provider = null,
        matchKey = null,
        matchValue = null
    } = queryParams;
    const dbConnect = await global.connectionManager.getModels(clientId);

    const offset = (page - 1) * limit;
    const where = {};

    if (service) where.service = service.toUpperCase();
    if (provider) where.provider = provider;
    if (matchKey) where.match_key = matchKey;
    if (matchValue) where.match_value = matchValue;

    const { count, rows } = await dbConnect.RoutingRule.findAndCountAll({
        where,
        limit,
        offset,
        order: [["updatedAt", "DESC"]]
    });

    return {
        rows,
        total: count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit)
    };
}

const updateRoutingRule = async (clientId, ruleId, payload) => {
    const { service, provider, matchKey, matchValue } = payload;
    const dbConnect = await global.connectionManager.getModels(clientId);

    const routingRuleExist = await dbConnect.RoutingRule.findOne({
        where: { id: ruleId }
    });

    if (!routingRuleExist) {
        throw {
            statusCode: 404,
            message: "Routing rule not found"
        }
    }

    const routingRule = await dbConnect.RoutingRule.findOne({
        where: { service: service.toUpperCase(), match_value: matchValue }
    });

    if (routingRule) {
        throw {
            statusCode: 409,
            message: `Routing rule for ${matchKey} "${matchValue}" already exists`
        }
    }


    await routingRuleExist.update({
        service: service.toUpperCase(),
        provider,
        match_key: matchKey,
        match_value: matchValue
    });

    const result = routingRuleExist.get({ plain: true });
    delete result.deletedAt;

    return result;
}

module.exports = {
    createRoutingRule,
    removeRoutingRule,
    getRoutingRules,
    updateRoutingRule
};