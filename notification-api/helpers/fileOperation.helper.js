const fse = require('fs-extra');
const axios = require('axios');
const path = require('path');
const logger = require('../src/logger');

const downloadS3File = async (s3Url, fileName, extension) => {
  const downloadDir = path.resolve(
    __dirname,
    '..',
    '..',
    'email-connector',
    'src',
    'uploads',
  );
  const msgId = fileName.split('/')[1];
  const localFilePath = path.join(downloadDir, `${msgId}.${extension}`);

  try {
    // 1. Ensure the folder exists
    await fse.ensureDir(downloadDir);

    const response = await axios({
      url: s3Url,
      method: 'GET',
      responseType: 'stream',
    });

    // 3. Create a write stream using fse
    const writer = fse.createWriteStream(localFilePath);

    // 4. Pipe the data from axios to the file
    response.data.pipe(writer);

    // 5. Manually wrap in a Promise to wait for completion
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        logger.info(`Download complete: ${localFilePath}`);
        resolve(localFilePath);
      });

      writer.on('error', (err) => {
        logger.error('File Stream error:', {
          errorMessage: err.message,
          stack: err.stack,
        });
        reject(err);
      });
    });
  } catch (err) {
    logger.error('Axios request failed:', {
      errorMessage: err.message,
      stack: err.stack,
    });
    throw err;
  }
};

const deleteLocalFile = async (filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    logger.error('Deletion skipped: Invalid path provided');
    return;
  }

  try {
    await fse.remove(filePath);
    logger.info('File successfully deleted', { filePath });
  } catch (error) {
    logger.error('Error in deleting file', error.message);
  }
};

module.exports = { downloadS3File, deleteLocalFile };
