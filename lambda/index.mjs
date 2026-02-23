import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION });

export const handler = async (event) => {
  console.log("=== New S3 Trigger Received ===");
  console.log(JSON.stringify(event, null, 2));

  const record = event?.Records?.[0];
  if (!record) {
    console.log("No S3 record found. Exiting.");
    return;
  }

  const region = record.awsRegion;
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

  console.log("Bucket:", bucket);
  console.log("Key:", key);

  /**
   * Expected key format:
   * uploads/<clientId>/<messageId>?<expectedCount>/file.png
   */
  const parts = key.split("/");
  if (parts.length < 4) {
    console.log("Invalid key structure. Exiting.");
    return;
  }

  const clientId = parts[1];
  const rawMessageId = parts[2];
  const [messageId, expectedCountStr] = rawMessageId.split("?");

  const expectedFileCount = Number(expectedCountStr);

  if (!expectedFileCount || Number.isNaN(expectedFileCount)) {
    console.log("Expected file count missing or invalid. Exiting.");
    return;
  }

  console.log("Client ID:", clientId);
  console.log("Message ID:", messageId);
  console.log("Expected files:", expectedFileCount);

  const prefix = `uploads/${clientId}/${rawMessageId}/`;

  try {
    /**
     * Get all uploaded files under prefix
     */
    const fileKeys = await getFilesForPrefix(bucket, prefix);
    console.log("Uploaded file count:", fileKeys.length);

    if (fileKeys.length < expectedFileCount) {
      console.log(
        `Waiting for more files (${fileKeys.length}/${expectedFileCount})`,
      );
      return;
    }

    /**
     * Build file URLs
     */
    const mediaUrls = await Promise.all(
      fileKeys.map(async (fileKey) => {
        const command = new GetObjectCommand({
          Bucket: bucket,
          Key: fileKey,
        });

        const url = await getSignedUrl(s3, command, {
          expiresIn: 60 * 60, // 1 hour
        });

        return {
          fileName: fileKey.split("/").pop(),
          url,
        };
      }),
    );

    const payload = {
      clientId,
      messageId,
      attachments: mediaUrls,
    };

    console.log("Final payload:", JSON.stringify(payload, null, 2));

    /**
     * Notify backend
     */
    const BACKEND_URL = process.env.BACKEND_URL;

    const response = await fetch(`${BACKEND_URL}/notify-with-attachment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": clientId,
        "ngrok-skip-browser-warning": "69420",
      },
      body: JSON.stringify(payload),
    });

    console.log("Backend response status:", response.status);
  } catch (err) {
    console.error("CRITICAL ERROR:", err);
    throw err;
  }

  console.log("=== Lambda Execution Finished ===");
};

/**
 * List ALL files under a prefix (pagination-safe)
 */
const getFilesForPrefix = async (bucket, prefix) => {
  let files = [];
  let continuationToken;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    if (res.Contents) {
      for (const obj of res.Contents) {
        if (!obj.Key.endsWith("/") && !obj.Key.endsWith(".completed")) {
          files.push(obj.Key);
        }
      }
    }

    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return files;
};