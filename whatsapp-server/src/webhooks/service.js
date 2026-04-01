const updateWhatsAppMessageStatus = async (status, referenceId, clientId, provider) => {
  const dbConnect = await global.connectionManager.getModels(clientId);
  await dbConnect.Notification.update(
    {
      status: `${provider} : ${status}`,
    },
    { where: { referenceId } }
  );
};

module.exports = { updateWhatsAppMessageStatus };
