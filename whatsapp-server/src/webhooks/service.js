const updateWhatsAppMessageStatus = async (status, referenceId, clientId) => {
  const dbConnect = await global.connectionManager.getModels(clientId);
  await dbConnect.Notification.update(
    {
      status,
    },
    { where: { referenceId } },
  );
};

module.exports = { updateWhatsAppMessageStatus };
