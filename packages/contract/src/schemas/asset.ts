import { z } from "zod";
import { IsoDateSchema } from "./common";

export type AssetType = "image" | "font" | "video" | "audio" | "other";

export const AssetTypeSchema = z.enum(["image", "font", "video", "audio", "other"]);

/** 资产索引条目（is_remote=false 的本地资产只登记清单，不存字节） */
export const AssetIndexEntrySchema = z.object({
  path: z.string().min(1).max(1024),
  isRemote: z.boolean(),
  assetType: AssetTypeSchema,
  fileType: z.string().min(1).max(64),
  /** 本地资产内容 hash（远程资产可为空） */
  checksum: z.string().max(128).nullable().optional(),
  /** R2 对象 key（仅远程资产） */
  r2Key: z.string().max(1024).nullable().optional(),
  size: z.number().int().nonnegative().nullable().optional(),
  updatedAt: IsoDateSchema,
});

export type AssetIndexEntry = z.infer<typeof AssetIndexEntrySchema>;

/** R2 presign 请求：CLI/管理台上传图片直传 R2，不经 Worker 字节 */
export const PresignRequestSchema = z.object({
  /** 相对 assetsDir 的目标路径（作为 R2 key 前缀的一部分） */
  key: z
    .string()
    .regex(/^[a-zA-Z0-9_\-/]+(\.[a-zA-Z0-9]+)?$/)
    .max(512),
  contentType: z.string().min(1).max(128),
  size: z
    .number()
    .int()
    .positive()
    .max(100 * 1024 * 1024),
});

export type PresignRequest = z.infer<typeof PresignRequestSchema>;

export const PresignResponseSchema = z.object({
  key: z.string(),
  url: z.string().url(),
  method: z.literal("PUT"),
  headers: z.record(z.string(), z.string()),
  expiresAt: IsoDateSchema,
});

export type PresignResponse = z.infer<typeof PresignResponseSchema>;

/** 上传完成后登记为远程资产 */
export const RegisterAssetRequestSchema = z.object({
  path: z.string().min(1).max(1024),
  assetType: AssetTypeSchema,
  fileType: z.string().min(1).max(64),
  r2Key: z.string().min(1).max(1024),
  checksum: z.string().max(128).nullable().optional(),
  size: z.number().int().nonnegative().nullable().optional(),
});

export type RegisterAssetRequest = z.infer<typeof RegisterAssetRequestSchema>;

export const RegisterAssetResponseSchema = z.object({
  path: z.string(),
  registered: z.boolean(),
});

export type RegisterAssetResponse = z.infer<typeof RegisterAssetResponseSchema>;

export const AssetsListResponseSchema = z.object({
  assets: z.array(AssetIndexEntrySchema),
});

export type AssetsListResponse = z.infer<typeof AssetsListResponseSchema>;
