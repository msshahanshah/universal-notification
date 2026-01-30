const { S3Client } = require("@aws-sdk/client-s3");
const { createPresignedPost } = require("@aws-sdk/s3-presigned-post");

const s3Client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const generatePreSignedUrl = async (clientId, messageId, attachements) => {
  try {
    const urls = await Promise.all(
      attachements?.map(async (file) => {
        const fileKey = `uploads/${clientId}/${messageId}?${attachements.length}/${file}`; // clientId/messageId?size/file_name
        const params = {
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: fileKey, // file name
          Conditions: [["content-length-range", 0, 20 * 1024 * 1024]], // 20 MB
          Expires: 300,
          // Fields: {
          //   "Content-Type": ""
          // }
        };
        return { [file]: await createPresignedPost(s3Client, params) };
      }),
    );

    return urls;
  } catch (err) {
    console.error("S3 Presigned URL Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Error in genearting preSignedUrl." });
  }
};

module.exports = { generatePreSignedUrl };
