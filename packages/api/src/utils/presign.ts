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
  const { endpoint, accessKeyId, secretAccessKey, bucket, key, contentType, expiresSeconds } =
    options;
  const base = endpoint.replace(/\/+$/, "");
  const url = `${base}/${bucket}/${key}?X-Amz-Expires=${String(expiresSeconds)}`;

  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
  });

  // 把 Content-Type 纳入签名（X-Amz-SignedHeaders=content-type;host）：客户端 PUT
  // 必须带匹配的 content-type，防止 URL 被用来上传任意类型内容（CF 官方推荐做法）。
  const signed = await aws.sign(
    new Request(url, {
      method: "PUT",
      headers: { "content-type": contentType },
    }),
    { aws: { signQuery: true } },
  );

  return signed.url;
}
