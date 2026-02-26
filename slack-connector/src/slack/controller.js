const SlackService = require("./service");

class SlackController {
  static async getSlackReplyMessage(req, res) {
    try {
      const result = await SlackService.getSlackReplyMessage(req.body);
      res.status(200).send(result);
    } catch (err) {
      res
        .status(err.statusCode)
        .send({ successs: false, message: err.message });
    }
  }
}

module.exports = SlackController;
