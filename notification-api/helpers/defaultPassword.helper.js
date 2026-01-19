const fs = require("fs").promises;
const path = require("path");
const bcrypt = require("bcrypt");

const generatePassword = async (username) => {
  // 8-char alphanumeric charset
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  let password = "";
  for (let i = 0; i < 8; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  const filePath = path.join(__dirname, "default_credentials.txt");

  // Append credentials (username + plain password)
  const fileLine = `${username} : ${password}\n`;
  await fs.appendFile(filePath, fileLine, { encoding: "utf8" });

  return hashedPassword;
};

module.exports = generatePassword;
