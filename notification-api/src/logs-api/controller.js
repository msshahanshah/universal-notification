const { viewDeliveryStatus, viewMessageLogs } = require('./service');

const deliveryStatus = async (req, res, next) => {
  try {
    const messageId = req.params.id;
    const clientId = req.header('X-Client-Id');

    const result = await viewDeliveryStatus(messageId, clientId);

    res.status(200).json({
      status: 'success',
      data: {
        messageId: result.messageId,
        deliveryStatus: result.status,
      },
    });
  } catch (error) {
    if (error.parent?.code === '22P02') {
      return res.status(400).json({ error: 'Message id is not valid' });
    }
    if (error.message === 'Message not found') {
      return res.status(404).json({ error: error.message });
    }

    return res.status(500).json({ error: error.message });
  }
};

const messageLogs = async (req, res) => {
  try {
    const { service = null, status = null, page = 1, limit = 10 } = req.query;

    const idClient = req.header('X-Client-Id');
    console.log(idClient);

    const { data, totalPages } = await viewMessageLogs(
      idClient,
      service,
      status,
      page,
      limit
    );
    return res.status(200).send({
      status: 'success',
      message: 'Data fetched successfully',
      data,
      pagination: {
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.log(error);
    if (error.message === 'Not authorized') {
      return res.status(404).send({
        message: error.message,
      });
    }

    return res.status(500).send({
      message: 'Internal Server Error',
    });
  }
};

module.exports = { deliveryStatus, messageLogs };
