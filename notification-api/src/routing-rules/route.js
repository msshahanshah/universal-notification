const express = require("express");
const routingRuleRouter = express();
const auth = require("../middleware/auth.middleware");
const accessControl = require("../middleware/access-control.middleware");
const createRouting = require("./controller");
const validateRequest = require("./validation")

routingRuleRouter.post("/routing-rules", auth, accessControl, validateRequest, createRouting);

module.exports = routingRuleRouter;