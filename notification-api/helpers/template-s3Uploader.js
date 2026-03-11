const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
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
    // const response = await s3.send(command);
    // const streamToString = async (stream) => {
    //     return await new Promise((resolve, reject) => {
    //         const chunks = [];
    //         stream.on("data", (chunk) => chunks.push(chunk));
    //         stream.on("error", reject);
    //         stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    //     });
    // };

    // const htmlContent = await streamToString(response.Body);
    // return htmlContent;
}

module.exports = { uploadTemplateToS3, getTemplatePreSigned };