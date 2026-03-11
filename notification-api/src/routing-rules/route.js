const express = require("express");
const routingRuleRouter = express();
const auth = require("../middleware/auth.middleware");
const accessControl = require("../middleware/access-control.middleware");
const { createRouting, removeRouting } = require("./controller");
const validateRequest = require("./validation")

routingRuleRouter.post("/routing-rules", auth, accessControl, validateRequest, createRouting);
routingRuleRouter.delete("/routing-rules/:ruleId", auth, accessControl, removeRouting)

module.exports = routingRuleRouter;