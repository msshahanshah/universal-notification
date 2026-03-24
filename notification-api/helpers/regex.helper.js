const fileNameRegex = new RegExp(
  /^(?![ .])(?!.*[ .]$)[^\\\/:*?"<>|\r\n]+$/u
);

const fileNameRegexWithExtension = new RegExp(
  /^(?![ .])(?!.*[ .]$)[^\\\/:*?"<>|\r\n]+\.[^\\\/:*?"<>|\r\n.]+$/u
);
const urlRegex = new RegExp(
  '^https?:\\/\\/(?:[a-z0-9.-]+\\.)?s3(?:[.-][a-z0-9-]+)?\\.amazonaws\\.com(?:\\/[\\S]*?)?\\?.*(?:X-Amz-Signature=|X-Amz-Credential=|AWSAccessKeyId=)',
  'i',
);
const slackChannelIdRegex = new RegExp(/^[CGD][A-Z0-9]{8,10}$/);

const validPublicURL = (str) => {
  var pattern =
    /^(https:\/\/)([\w-]+\.)+[\w-]+(\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?$/i;
  return pattern.test(str);
};

const phonenNumberRegex = new RegExp(/^\+[0-9]+$/);
module.exports = {
  fileNameRegex,
  urlRegex,
  slackChannelIdRegex,
  phonenNumberRegex,
  validPublicURL,
  fileNameRegexWithExtension
};
