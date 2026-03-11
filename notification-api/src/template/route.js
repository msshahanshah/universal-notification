const express = require("express");
const templateRouter = express.Router();
const auth = require("../middleware/auth.middleware");
const accessControl = require("../middleware/access-control.middleware");
const { createTemplate, viewTemplates } = require("./controller");
const { validateRegisterTemplateBody } = require("./validation");

templateRouter.post("/templates", validateRegisterTemplateBody, createTemplate);
templateRouter.get("/templates", viewTemplates);

module.exports = templateRouter;