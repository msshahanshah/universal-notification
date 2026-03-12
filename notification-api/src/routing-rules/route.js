const express = require("express");
const routingRuleRouter = express();
const auth = require("../middleware/auth.middleware");
const accessControl = require("../middleware/access-control.middleware");
const { createRouting, removeRouting, viewRouting, updateRouting } = require("./controller");
const { validateCreateRequest, validateQueryRequest } = require("./validation")

routingRuleRouter.post("/routing-rules", auth, accessControl, validateCreateRequest, createRouting);
routingRuleRouter.delete("/routing-rules/:ruleId", auth, accessControl, removeRouting);
routingRuleRouter.get("/routing-rules", auth, accessControl, validateQueryRequest, viewRouting);
routingRuleRouter.put("/routing-rules/:ruleId", auth, accessControl, validateCreateRequest, updateRouting);

module.exports = routingRuleRouter;