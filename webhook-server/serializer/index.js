const webhookConfigSerializer = (data) => {
  return data?.map(({ _id, ...rest }) => ({
    id: _id,
    ...rest,
  }));
};

const webhookLogsSerializer = (data) => {
  return data?.map(({ _id, ...rest }) => ({
    id: _id,
    ...rest,
  }));
};

module.exports = {
  webhookConfigSerializer,
  webhookLogsSerializer,
};
