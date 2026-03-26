const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const MASTER_KEY = process.env.MASTER_ENCRYPTION_KEY;

// Convert key → 32 bytes
const getKey = (key) => crypto.createHash("sha256").update(key).digest();

const encrypt = (text, key = MASTER_KEY) => {
  if (!text) return "";

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(key), iv);

  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // return everything in one string
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`;
};

const decrypt = (data, key = MASTER_KEY) => {
  if (!data) return "";

  const [ivHex, encryptedHex, authTagHex] = data.split(":");

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(key),
    Buffer.from(ivHex, "hex"),
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};

module.exports = { encrypt, decrypt };
