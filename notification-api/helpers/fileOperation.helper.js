const fse = require("fs-extra");
const axios = require("axios");
const path = require("path");
const logger = require("../src/logger");

const downloadS3File = async (s3Url) => {
  // 1. Remove "?1/" safely
  const cleanUrl = s3Url.replace(/\?.*?\//, "/");

  // 2. Extract path after /uploads/
  const relativePath = cleanUrl.split("/uploads/")[1];

  // 3. Split into parts
  const [client, messageId, fileName] = relativePath.split("/");

  // 4. Build directory path (NO filename here)
  const downloadDir = path.resolve(
    __dirname,
    "..",
    "..",
    "email-connector",
    "src",
    "uploads",
    client,
    messageId,
  );

  // 5. Final file path
  const localFilePath = path.join(downloadDir, fileName);

  try {
    console.log("downloadDir >>>", downloadDir);
    console.log("localFilePath >>>", localFilePath);

    // 6. Ensure directory exists
    await fse.ensureDir(downloadDir);
    let newS3Url = s3Url.replace("?", "%3F"); // % -> %3F
    // 7. Download
    const response = await axios({
      url: newS3Url,
      method: "GET",
      responseType: "stream",
    });

    const writer = fse.createWriteStream(localFilePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => resolve(localFilePath));
      writer.on("error", reject);
    });
  } catch (err) {
    logger.error("Download failed:", err);
    throw err;
  }
};

const deleteLocalFile = async (filePath) => {
  if (!filePath || typeof filePath !== "string") {
    logger.error("Deletion skipped: Invalid path provided");
    return;
  }

  try {
    await fse.remove(filePath);
    logger.info("File successfully deleted", { filePath });
  } catch (error) {
    logger.error("Error in deleting file", error.message);
  }
};

module.exports = { downloadS3File, deleteLocalFile };
