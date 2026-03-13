const express = require("express");
const auth = require("../middleware/auth.middleware");
const accessControl = require("../middleware/access-control.middleware");
const {
  createRouting,
  removeRouting,
  viewRouting,
  updateRouting,
} = require("./controller");
const { validateCreateRequest, validateQueryRequest } = require("./validation");

const routingRuleRouter = express.Router();

routingRuleRouter.use(auth);
routingRuleRouter.use(accessControl);
routingRuleRouter.post("/routing-rules", validateCreateRequest, createRouting);
routingRuleRouter.delete("/routing-rules/:ruleId", removeRouting);
routingRuleRouter.get("/routing-rules", validateQueryRequest, viewRouting);
routingRuleRouter.put(
  "/routing-rules/:ruleId",
  validateCreateRequest,
  updateRouting,
);

module.exports = routingRuleRouter;
