const webhookService = require("./service");

async function addWebhook(req, res) {
  try {
    const clientId = req.headers["x-client-id"];
    const result = await webhookService.addWebhook(req.body, clientId);
    res.status(201).json(result);
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
    const result = await webhookService.updateWebhook(
      req.body,
      webhookId,
      clientId,
    );
    res.status(201).json(result);
  } catch (error) {
    error.message = error?.message || "Internal server error";
    error.statusCode = error?.statusCode || 500;
    res
      .status(error.statusCode)
      .json({ success: false, message: error.message });
  }
}
async function deleteWebhook(req, res) {
  try {
    const clientId = req.headers["x-client-id"];
    const webhookId = req.params.webhookId;
    const result = await webhookService.deleteWebhook(webhookId, clientId);
    res.status(201).json(result);
  } catch (error) {
    error.message = error?.message || "Internal server error";
    error.statusCode = error?.statusCode || 500;
    res
      .status(error.statusCode)
      .json({ success: false, message: error.message });
  }
}

module.exports = { addWebhook, updateWebhook, deleteWebhook };
