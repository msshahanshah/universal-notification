const { v4: uuidv4 } = require("uuid");
const { uploadTemplateToS3, getTemplatePreSigned } = require("../../helpers/template-s3Uploader");

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

    return result;
}

const getTemplates = async (clientId) => {
    let dbConnect = await global.connectionManager.getModels(clientId);

    const templates = await dbConnect.Template.findAll({ raw: true });

    for (let template of templates) {
        if (template.service === "email") {
            const fileKey = `templates/${clientId}/${template.templateId}.html`;

            const preSignedUrl = await getTemplatePreSigned(fileKey);

            template.templateUrl = preSignedUrl;
        }
    }
    return templates;
}

module.exports = {
    registerTemplate,
    getTemplates
}