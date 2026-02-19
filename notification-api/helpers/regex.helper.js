const fileNameRegex = new RegExp(/^(?![ .])(?!.*[ .]$)[A-Za-z0-9._ -]+$/);
const urlRegex = new RegExp(
  "^https?:\\/\\/(?:[a-z0-9.-]+\\.)?s3(?:[.-][a-z0-9-]+)?\\.amazonaws\\.com(?:\\/[\\S]*?)?\\?.*(?:X-Amz-Signature=|X-Amz-Credential=|AWSAccessKeyId=)",
  "i",
);
const slackChannelIdRegex = new RegExp(/^[CGD][A-Z0-9]{8,10}$/);

const phonenNumberRegex = new RegExp(/^\+[0-9]+$/);
module.exports = {
  fileNameRegex,
  urlRegex,
  slackChannelIdRegex,
  phonenNumberRegex,
};
