const express = require("express");
const SlackController = require("./controller");
const router = express.Router();

router.post("/webhook", SlackController.slackReplyMessage);
module.exports = router;
