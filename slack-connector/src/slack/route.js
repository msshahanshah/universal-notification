const express = require("express");
const SlackController = require("./controller");
const router = express.Router();

router.post("/webhook", SlackController.getSlackReplyMessage);
module.exports = router;
