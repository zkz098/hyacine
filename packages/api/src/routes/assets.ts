import { Hono } from "hono";
import {
  AssetTypeSchema,
  PresignRequestSchema,
  RegisterAssetRequestSchema,
} from "@hyacine/contract";
import { errorBody, flattenZodError } from "../utils/errors";
import { loadEffectiveConfig } from "../utils/config";
import { createPresignedPutUrl } from "../utils/presign";
import { authMiddleware } from "../middleware/auth";
import { getDb } from "../utils/db";
import type { Env, Variables } from "../types";

export function assetsRoutes(app: Hono<{ Bindings: Env; Variables: Variables }>): void {
  app.post("/api/assets/presign", authMiddleware(["posts.w"]), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = PresignRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorBody("validation_error", "参数错误", flattenZodError(parsed.error)), 400);
    }

    const { key, contentType } = parsed.data;

    const db = getDb(c);
    const cfg = await loadEffectiveConfig(c.env, db);
    const endpoint = cfg.r2.endpoint;
    const accessKeyId = cfg.r2.accessKeyId;
    const secretAccessKey = cfg.r2.secretAccessKey;
    const bucket = cfg.r2.bucket;

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
      return c.json(errorBody("r2_not_configured", "未配置 R2 S3 凭据"), 503);
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
      // content-type 已纳入签名，客户端必须带；不要返回 content-length
      // （浏览器 fetch 的 forbidden header，会被静默忽略）
      headers: { "content-type": contentType },
      expiresAt,
    });
  });

  app.post("/api/assets/register", authMiddleware(["posts.w"]), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = RegisterAssetRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorBody("validation_error", "参数错误", flattenZodError(parsed.error)), 400);
    }

    const { path, assetType, fileType, r2Key, checksum, size } = parsed.data;
    const now = new Date().toISOString();
    const db = getDb(c);

    await db
      .prepare(
        "INSERT INTO assets (path, is_remote, asset_type, file_type, r2_key, checksum, size, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(path) DO UPDATE SET is_remote=excluded.is_remote, asset_type=excluded.asset_type, file_type=excluded.file_type, r2_key=excluded.r2_key, checksum=excluded.checksum, size=excluded.size, updated_at=excluded.updated_at",
      )
      .bind(path, 1, assetType, fileType, r2Key, checksum ?? null, size ?? null, now)
      .run();

    return c.json({ path, registered: true });
  });

  app.get("/api/assets", authMiddleware(["posts.r"]), async (c) => {
    const db = getDb(c);
    const result = await db
      .prepare(
        `SELECT path, is_remote, asset_type, file_type, r2_key, checksum, size, updated_at
       FROM assets
       ORDER BY datetime(updated_at) DESC`,
      )
      .all<{
        path: string;
        is_remote: number;
        asset_type: string;
        file_type: string;
        r2_key: string | null;
        checksum: string | null;
        size: number | null;
        updated_at: string;
      }>();

    const assets = result.results.map((row) => {
      const assetType = AssetTypeSchema.safeParse(row.asset_type);
      return {
        path: row.path,
        isRemote: row.is_remote === 1,
        assetType: assetType.success ? assetType.data : "other",
        fileType: row.file_type,
        r2Key: row.r2_key,
        checksum: row.checksum,
        size: row.size,
        updatedAt: row.updated_at,
      };
    });
    return c.json({ assets });
  });
}
