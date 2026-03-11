const slackService = require("./service");

async function getSlackReplyMessage(req, res) {
  try {
    
    const result = await slackService.getSlackReplyMessage(req.body);
    res.status(200).send(result);
  } catch (err) {
    res.status(err.statusCode).send({ successs: false, message: err.message });
  }
}

module.exports = { getSlackReplyMessage };
