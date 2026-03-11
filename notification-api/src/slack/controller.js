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
      "from-date": fromDate = null,
      "to-date": toDate = null,
    } = req.query;

    const limitInt = parseInt(limit);
    const idClient = req.header("X-Client-Id");
    const logType = LOG_TYPE.COMMON_LOGS;

    const { data, totalPages } = await viewMessageLogs(
      idClient,
      logType,
      service,
      status,
      page,
      limitInt,
      order,
      sort,
      message,
      destination,
      attempts,
      cc,
      bcc,
      fromEmail,
      fromDate,
      toDate,
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
