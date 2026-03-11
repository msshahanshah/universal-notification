const { viewMessageLogs } = require("../logs-api/service.js");
const { LOG_TYPE } = require("../../constants/index.js");
const slackMessageLogs = async (req, res) => {
  try {
    const {
      service = null,
      status = null,
      page = 1,
      limit = 10,
      order = "desc",
      sort = null,
      message = null,
      destination = null,
      attempts = null,
      cc = null,
      bcc = null,
      fromEmail = null,
      "start-time": startTime = null,
      "end-time": endTime = null,
    } = req.query;

    const idClient = req.header("X-Client-Id");
    const logType = LOG_TYPE.SLACK_LOGS; //to confirm that slack-logs api is called which logs we need

    const { data, totalPages } = await viewMessageLogs(
      idClient,
      logType,
      service,
      status,
      page,
      limit,
      order,
      sort,
      message,
      destination,
      attempts,
      cc,
      bcc,
      fromEmail,
      startTime,
      endTime,
    );
    return res.status(200).send({
      success: true,
      message: "Data fetched successfully",
      data,
      pagination: {
        page: +page,
        limit: data.length,
        totalPages,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).send({
      message: error.message || "Internal Server Error",
      success: false,
    });
  }
};

module.exports = { slackMessageLogs };
