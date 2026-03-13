const express = require("express");
const templateRouter = express.Router();
const auth = require("../middleware/auth.middleware");
const accessControl = require("../middleware/access-control.middleware");
const { createTemplate, viewTemplates, deleteTemplate, updateTemplate } = require("./controller");
const { validateRegisterTemplateBody, validateQueryTemplateRequest, validateParamId } = require("./validation");

templateRouter.post("/templates", auth, accessControl, validateRegisterTemplateBody, createTemplate);
templateRouter.get("/templates", auth, accessControl, validateQueryTemplateRequest, viewTemplates);
templateRouter.delete("/templates/:id", auth, accessControl, validateParamId, deleteTemplate);
templateRouter.put("/templates/:id", auth, accessControl, validateParamId, validateRegisterTemplateBody, updateTemplate)

module.exports = templateRouter;