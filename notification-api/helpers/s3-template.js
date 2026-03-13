const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({
    region: process.env.AWS_SECRET_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const uploadTemplateToS3 = async (fileKey, htmlContent) => {
    const params = {
        Bucket: process.env.AWS_TEMPLATE_BUCKET_NAME,
        Key: fileKey,
        Body: htmlContent,
        ContentType: "text/html"
    }

    const command = new PutObjectCommand(params);

    await s3.send(command);

    return fileKey;
}

const getTemplatePreSigned = async (fileKey) => {
    const params = {
        Bucket: process.env.AWS_TEMPLATE_BUCKET_NAME,
        Key: fileKey
    };

    const command = new GetObjectCommand(params);

    const url = await getSignedUrl(s3, command, {
        expiresIn: 3600 // URL valid for 1 hour
    });

    return url;
}

const removeTemplateFromS3 = async (fileKey) => {
    const params = {
        Bucket: process.env.AWS_TEMPLATE_BUCKET_NAME,
        Key: fileKey
    };

    const command = new DeleteObjectCommand(params);
    await s3.send(command);
}

module.exports = { uploadTemplateToS3, getTemplatePreSigned, removeTemplateFromS3};