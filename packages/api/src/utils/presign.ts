import { AwsClient } from "aws4fetch";

export interface PresignOptions {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  key: string;
  contentType: string;
  expiresSeconds: number;
}

export async function createPresignedPutUrl(options: PresignOptions): Promise<string> {
  const { endpoint, accessKeyId, secretAccessKey, bucket, key, expiresSeconds } = options;
  const base = endpoint.replace(/\/+$/, "");
  const url = `${base}/${bucket}/${key}?X-Amz-Expires=${String(expiresSeconds)}`;

  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
  });

  const signed = await aws.sign(url, {
    method: "PUT",
    aws: { signQuery: true },
  });

  return signed.url;
}
