const webhookService = require("./service");

// common error handler (optional but clean)
const handleError = (res, error) => {
  const statusCode = error?.statusCode || 500;
  const message = error?.message || "Internal server error";

  return res.status(statusCode).json({
    success: false,
    message,
  });
};

// ---------------- ADD ----------------
async function addWebhook(req, res) {
  try {
    const clientId = req.headers["x-client-id"];

    await webhookService.addWebhook(req.body, clientId);

    return res.status(201).json({
      success: true,
      message: "webhook configuration added successfully.",
    });
  } catch (error) {
    return handleError(res, error);
  }
}

// ---------------- UPDATE ----------------
async function updateWebhook(req, res) {
  try {
    const clientId = req.headers["x-client-id"];
    const webhookId = req.params.webhookId;

    await webhookService.updateWebhook(req.body, webhookId, clientId);

    return res.status(200).json({
      success: true,
      message: "webhook configuration updated successfully.",
    });
  } catch (error) {
    return handleError(res, error);
  }
}

// ---------------- DELETE ----------------
async function deleteWebhook(req, res) {
  try {
    const clientId = req.headers["x-client-id"];
    const webhookId = req.params.webhookId;

    await webhookService.deleteWebhook(webhookId, clientId);

    return res.status(200).json({
      success: true,
      message: "webhook configuration deleted successfully.",
    });
  } catch (error) {
    return handleError(res, error);
  }
}

// ---------------- GET ----------------
async function getWebhooks(req, res) {
  try {
    const clientId = req.headers["x-client-id"];

    const result = await webhookService.getWebhookConfigs(clientId, req.query);

    return res.status(200).json({
      success: true,
      message: "webhook configuration fetched successfully.",
      data: result,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

module.exports = {
  addWebhook,
  updateWebhook,
  deleteWebhook,
  getWebhooks,
};
