const { v4: uuidv4 } = require("uuid");
const { uploadTemplateToS3, getTemplatePreSigned, removeTemplateFromS3 } = require("../../helpers/s3-template");
const validateTemplate = require("../../helpers/htmlValidation");

const verifyVariables = (messageContent, variables) => {
    const matches = [...messageContent.matchAll(/{{(.*?)}}/g)];

    const extracted = [
        ...new Set(matches.map(m => m[1].trim()))
    ];
    const payloadVars = variables.map(v => v.name.trim());

    const allMatched =
        payloadVars.every(v => extracted.includes(v)) &&
        extracted.every(v => payloadVars.includes(v));

    return allMatched;
}


const buildHTML = (messageContent) => {
    return `<!DOCTYPE html>
        <html>
            <body>
                ${messageContent}
            </body>
        </html>`;
}


const registerTemplate = async (clientId, payload) => {
    let { service, templateId = null, name, messageContent, variables } = payload;

    let dbConnect = await global.connectionManager.getModels(clientId);

    if (service === "email") {
        validateTemplate(messageContent);
    }

    if (!verifyVariables(messageContent, variables)) {
        throw {
            statusCode: 400,
            message: "Your variables not matched with message content"
        }
    }

    if (!templateId && ["email", "slack"].includes(service)) {
        templateId = uuidv4();
    }

    const templateExist = await dbConnect.Template.findOne({
        where: { template_id: templateId }
    });

    if (templateExist) {
        throw {
            statusCode: 409,
            message: "TemplateId already exists"
        }
    }

    const templateExistWithSameName = await dbConnect.Template.findOne({
        where: { service, name }
    });

    if (templateExistWithSameName) {
        throw {
            statusCode: 409,
            message: `Template name ${name} for ${service} already exists`
        }
    }

    let templateKey;
    if (service === "email") {
        const htmlFile = buildHTML(messageContent);
        const fileKey = `templates/${clientId}/${templateId}.html`;
        templateKey = await uploadTemplateToS3(fileKey, htmlFile);
    }

    const template = await dbConnect.Template.create({
        templateId: templateId,
        service: service,
        name: name,
        messageContent: service === "email" ? templateKey : messageContent,
        requiredFields: variables
    });

    const result = template.get({ plain: true });
    delete result.deletedAt;
    result.messageContent = messageContent;

    return result;
}


const getTemplates = async (clientId, queryParams) => {
    const {
        limit = 10,
        page = 1,
        service = null,
        name = null,
        templateId = null
    } = queryParams
    let dbConnect = await global.connectionManager.getModels(clientId);

    const offset = (page - 1) * limit;
    const where = {};

    if (service) where.service = service.toUpperCase();
    if (templateId) where.template_id = templateId;
    if (name) where.name = name;


    const { count, rows } = await dbConnect.Template.findAndCountAll({
        where,
        limit,
        offset,
        order: [["updatedAt", "DESC"]],
        raw: true
    });

    const templates = rows;

    for (let template of templates) {
        if (template.service === "email") {
            const fileKey = `templates/${clientId}/${template.templateId}.html`;

            const preSignedUrl = await getTemplatePreSigned(fileKey);

            template.messageContent = preSignedUrl;
            delete template.deletedAt;
        }
    }
    return {
        templates,
        total: count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit)
    };
}


const removeTemplate = async (clientId, id) => {
    const dbConnect = await global.connectionManager.getModels(clientId);

    const templateExist = await dbConnect.Template.findOne({
        where: { id }
    });

    if (!templateExist) {
        throw {
            statusCode: 404,
            message: "Template not found"
        }
    }

    if (templateExist.service === "email") {
        removeTemplateFromS3(templateExist.messageContent);
    }

    await templateExist.destroy();
}


const modifyService = async (clientId, id, payload) => {
    const { service, templateId, name, messageContent, variables } = payload;
    const dbConnect = await global.connectionManager.getModels(clientId);

    const templateExist = await dbConnect.Template.findOne({
        where: { id }
    });

    if (!templateExist) {
        throw {
            statusCode: 404,
            message: "Template not found"
        };
    }

    const { Op } = dbConnect.Sequelize;
    let finalTemplateId = templateId || templateExist.templateId;

    const templateIdExist = await dbConnect.Template.findOne({
        where: { templateId: finalTemplateId, id: { [Op.ne]: id } }
    });

    if (templateIdExist) {
        throw {
            statusCode: 409,
            message: "TemplateId already exists"
        }
    }

    if (service === "email" && messageContent) {
        validateTemplate(messageContent);
    }

    if (messageContent && variables && !verifyVariables(messageContent, variables)) {
        throw {
            statusCode: 400,
            message: "Your variables not matched with message content"
        };
    }

    const templateExistWithSameName = await dbConnect.Template.findOne({
        where: { service, name, id: { [Op.ne]: id } }
    });

    if (templateExistWithSameName) {
        throw {
            statusCode: 409,
            message: `Template name ${name} for ${service} already exists`
        };
    }


    if (service !== "email") {
        if (templateExist.service === "email") {
            await removeTemplateFromS3(templateExist.messageContent);
        }
    }

    let templateKey;
    if (service === "email") {
        const htmlFile = buildHTML(messageContent);
        
        if (templateExist.service === "email") {
            await removeTemplateFromS3(templateExist.messageContent);
        }
        const fileKey = `templates/${clientId}/${finalTemplateId}.html`;
        templateKey = await uploadTemplateToS3(fileKey, htmlFile);
    }

    const updatedTemplate = await templateExist.update({
        templateId: finalTemplateId,
        service: service,
        name: name,
        messageContent: service === "email" ? templateKey : messageContent,
        requiredFields: variables
    });

    const result = updatedTemplate.get({ plain: true });
    delete result.deletedAt;
    result.messageContent = messageContent

    return result;
}

module.exports = {
    registerTemplate,
    getTemplates,
    removeTemplate,
    modifyService
}