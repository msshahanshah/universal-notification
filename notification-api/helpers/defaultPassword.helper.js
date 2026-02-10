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

  const filePath = path.join(__dirname, "default_credentials.json");

  const oldCred = JSON.parse(await fs.readFile(filePath));
  const newCreds = JSON.stringify(
    Object.assign({}, { [username]: password }, oldCred),
    null,
    2,
  );
  await fs.writeFile(filePath, newCreds, {
    encoding: "utf8",
  });

  return hashedPassword;
};

module.exports = generatePassword;
