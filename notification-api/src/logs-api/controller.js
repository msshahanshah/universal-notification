const { viewDeliveryStatus, viewMessageLogs } = require("./service");

const deliveryStatus = async (req, res, next) => {
  try {
    const messageId = req.params.id;
    const clientId = req.header("X-Client-Id");

    const result = await viewDeliveryStatus(messageId, clientId);

    res.status(200).json({
      success: true,
      data: {
        messageId: result.messageId,
        deliveryStatus: result.status,
      },
    });
  } catch (error) {
    if (error.parent?.code === "22P02") {
      return res
        .status(400)
        .json({ message: "Message id is not valid", success: false });
    }
    if (error.message === "Message not found") {
      return res.status(404).json({ message: error.message, success: false });
    }

    return res.status(500).json({ message: error.message, success: false });
  }
};

const messageLogs = async (req, res) => {
  try {
    const { service = null, status = null, page = 1, limit = 10 } = req.query;

    const idClient = req.header("X-Client-Id");

    const { data, totalPages } = await viewMessageLogs(
      idClient,
      service,
      status,
      page,
      limit
    );
    return res.status(200).send({
      success: true,
      message: "Data fetched successfully",
      data,
      pagination: {
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    if (error.message === "Not authorized") {
      return res.status(401).send({
        message: error.message,
        success: false,
      });
    }

    return res.status(500).send({
      message: "Internal Server Error",
      success: false,
    });
  }
};

module.exports = { deliveryStatus, messageLogs };
