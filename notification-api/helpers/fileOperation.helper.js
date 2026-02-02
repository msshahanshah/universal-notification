const fse = require("fs-extra");
const axios = require("axios");
const path = require("path");
const logger = require("../src/logger");

const downloadS3File = async (
  s3Url,
  filename,
  messageId,
  isPresigned = false,
) => {
  // create download
  const downloadDir = path.resolve(
    __dirname,
    "..",
    "..",
    "email-connector",
    "src",
    "uploads",
    messageId,
  );
  await fse.ensureDir(downloadDir);
  const localFilePath = path.join(downloadDir, filename);

  try {
    console.log("downloadDir >>>", downloadDir);
    console.log("localFilePath >>>", localFilePath);

    let newS3Url = s3Url;
    if (!isPresigned) newS3Url = s3Url.replace("?", "%3F"); // % -> %3F
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
    logger.warn("Deletion skipped: Invalid filePath");
    return;
  }

  try {
    const stats = await fse.stat(filePath).catch(() => null);

    if (!stats) {
      logger.warn("Deletion skipped: File does not exist", { filePath });
      return;
    }

    if (!stats.isFile()) {
      logger.error("Deletion blocked: Path is not a file", { filePath });
      return;
    }

    await fse.unlink(filePath);
    logger.info("Local file deleted", { filePath });
  } catch (err) {
    logger.error("Error deleting local file", {
      filePath,
      error: err.message,
    });
  }
};

const deleteLocalFiles = async (paths = []) => {
  if (!Array.isArray(paths) || !paths.length) return;

  await Promise.all(paths.map((p) => deleteLocalFile(p)));
};

module.exports = { downloadS3File, deleteLocalFile, deleteLocalFiles };
