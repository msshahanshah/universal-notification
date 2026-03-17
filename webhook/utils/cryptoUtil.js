const crypto = require("crypto");
require("dotenv").config();

const algorithm = process.env.ALGORITHM;

// Always derive 32-byte key using SHA256
const getKey = (key) => {
  return crypto.createHash("sha256").update(key).digest();
};

const encrypt = (text, key) => {
  const iv = crypto.randomBytes(16);
  const akey = getKey(key);

  const cipher = crypto.createCipheriv(algorithm, akey, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
};

const decrypt = (encryptedText, key) => {
  const parts = encryptedText.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encryptedData = parts[1];
  const akey = getKey(key);

  const decipher = crypto.createDecipheriv(algorithm, akey, iv);

  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};

const generateSalt = (key) => {
  return key + process.env.MASTER_ENCRYPTION_KEY;
};

module.exports = { encrypt, decrypt, generateSalt };
