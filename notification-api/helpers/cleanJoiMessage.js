function cleanJoiMessage(message) {
  if (!message) return message;

  return message
    .replace(/\\\"/g, "")     // remove \"
    .replace(/"/g, "")        // remove "
    .replace(/\[\d+\]\.?/g, "") // remove [0]. [1]. etc
    .trim();
}

module.exports = cleanJoiMessage;