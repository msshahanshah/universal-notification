const webhookService = require("./service");

async function addWebhook(req, res) {
  try {
    const clientId = req.headers["x-client-id"];
    const { services } = await webhookService.addWebhook(req.body, clientId);

    // TODO update redis for enabled services
    res.status(201).json({
      success: true,
      message: "webhook configuration added successfully.",
    });
  } catch (error) {
    error.message = error?.message || "Internal server error";
    error.statusCode = error?.statusCode || 500;
    res
      .status(error.statusCode)
      .json({ success: false, message: error.message });
  }
}

async function updateWebhook(req, res) {
  try {
    const clientId = req.headers["x-client-id"];
    const webhookId = req.params.webhookId;

    const { services } = await webhookService.updateWebhook(
      req.body,
      webhookId,
      clientId,
    );
    res.status(201).json({
      success: true,
      message: "webhook configuration updated successfully.",
    });
  } catch (error) {
    error.message = error?.message || "Internal server error";
    error.statusCode = error?.statusCode || 500;
    return res
      .status(error.statusCode)
      .json({ success: false, message: error.message });
  }
}
async function deleteWebhook(req, res) {
  try {
    const clientId = req.headers["x-client-id"];
    const webhookId = req.params.webhookId;

    const { services } = await webhookService.deleteWebhook(
      webhookId,
      clientId,
    );
    res.status(204).json({
      success: true,
      message: "webhook configuration deleted successfully.",
    });
  } catch (error) {
    error.message = error?.message || "Internal server error";
    error.statusCode = error?.statusCode || 500;
    res
      .status(error.statusCode)
      .json({ success: false, message: error.message });
  }
}
async function getWebhooks(req, res) {
  try {
    const clientId = req.headers["x-client-id"];
    const result = await webhookService.getWebhooks(clientId);
    res.status(200).json({
      success: true,
      message: "webhook configuration fetched successfully.",
      data: result,
    });
  } catch (error) {
    error.message = error?.message || "Internal server error";
    error.statusCode = error?.statusCode || 500;
    res
      .status(error.statusCode)
      .json({ success: false, message: error.message });
  }
}

module.exports = { addWebhook, updateWebhook, deleteWebhook, getWebhooks };
