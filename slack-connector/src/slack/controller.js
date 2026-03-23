const slackService = require("./service");

async function slackReplyMessage(req, res) {
  try {
    const { challenge } = req.body;
    if (challenge) {
      return res.status(200).json({ challenge });
    }
    const result = await slackService.slackReplyMessage(req.body);
    res.status(200).send(result);
  } catch (err) {
    res.status(err.statusCode).send({ successs: false, message: err.message });
  }
}

module.exports = { slackReplyMessage };
