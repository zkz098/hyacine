import { Hono } from "hono";
import { PresignRequestSchema, RegisterAssetRequestSchema } from "@hyacine/contract";
import { errorBody } from "../utils/errors";
import { createPresignedPutUrl } from "../utils/presign";
import { authMiddleware } from "../middleware/auth";
import type { Env, Variables } from "../types";

export function assetsRoutes(app: Hono<{ Bindings: Env; Variables: Variables }>): void {
  app.post("/api/assets/presign", authMiddleware(["posts.w"]), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = PresignRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorBody("validation_error", "参数错误", parsed.error.flatten()), 400);
    }

    const { key, contentType, size } = parsed.data;

    const endpoint = c.env.R2_S3_ENDPOINT;
    const accessKeyId = c.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = c.env.R2_SECRET_ACCESS_KEY;
    const bucket = c.env.R2_BUCKET;

    if (
      endpoint === undefined ||
      endpoint.length === 0 ||
      accessKeyId === undefined ||
      accessKeyId.length === 0 ||
      secretAccessKey === undefined ||
      secretAccessKey.length === 0 ||
      bucket === undefined ||
      bucket.length === 0
    ) {
      return c.json(errorBody("ai_not_configured", "未配置 R2 S3 凭据"), 503);
    }

    const expiresSeconds = 300;
    const url = await createPresignedPutUrl({
      endpoint,
      accessKeyId,
      secretAccessKey,
      bucket,
      key,
      contentType,
      expiresSeconds,
    });

    const expiresAt = new Date(Date.now() + expiresSeconds * 1000).toISOString();

    return c.json({
      key,
      url,
      method: "PUT" as const,
      headers: { "content-type": contentType, "content-length": String(size) },
      expiresAt,
    });
  });

  app.post("/api/assets/register", authMiddleware(["posts.w"]), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = RegisterAssetRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorBody("validation_error", "参数错误", parsed.error.flatten()), 400);
    }

    const { path, assetType, fileType, r2Key, checksum, size } = parsed.data;
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      "INSERT INTO assets (path, is_remote, asset_type, file_type, r2_key, checksum, size, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(path) DO UPDATE SET is_remote=excluded.is_remote, asset_type=excluded.asset_type, file_type=excluded.file_type, r2_key=excluded.r2_key, checksum=excluded.checksum, size=excluded.size, updated_at=excluded.updated_at",
    )
      .bind(path, 1, assetType, fileType, r2Key, checksum ?? null, size ?? null, now)
      .run();

    return c.json({ path, registered: true });
  });
}
