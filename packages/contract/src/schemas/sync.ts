import { z } from "zod";
import { AssetIndexEntrySchema } from "./asset";
import { HashSchema, IsoDateSchema, PostPathSchema } from "./common";
import { PostIndexEntrySchema } from "./post";

/** 同步上行条目：索引 + 可选正文（带 content 时 API 落 posts.content，解锁自动 AI/Primary） */
export const SyncPostSchema = PostIndexEntrySchema.extend({
  content: z.string().min(1).optional(),
});

export type SyncPost = z.infer<typeof SyncPostSchema>;

/** 索引上行（全量快照，server 按 hash diff） */
export const SyncUploadRequestSchema = z.object({
  generatedAt: IsoDateSchema,
  posts: z.array(SyncPostSchema),
  assets: z.array(AssetIndexEntrySchema),
  /** 本地已删除（相对上次上行的存量） */
  deletedPaths: z.array(z.string().min(1)).default([]),
  /** 客户端项目指纹（如 github:owner/repo 或 uuid:...） */
  projectId: z.string().max(256).optional(),
  /** 是否强制同步（覆盖安全熔断 / 重绑） */
  force: z.boolean().optional(),
  /** 是否请求重绑远程项目身份（需 admin scope） */
  rebindProject: z.boolean().optional(),
  /** 是否允许突破大批量删除熔断保护 */
  allowBatchDelete: z.boolean().optional(),
});

export type SyncUploadRequest = z.infer<typeof SyncUploadRequestSchema>;

/** server 判定哪个 hash 缺哪类 AI 产物 */
export const SyncAiNeedSchema = z.object({
  hash: HashSchema,
  path: PostPathSchema,
  reason: z.enum(["summary", "embed", "both"]),
});

export type SyncAiNeed = z.infer<typeof SyncAiNeedSchema>;

export const SyncUploadResponseSchema = z.object({
  accepted: z.object({
    posts: z.number().int().nonnegative(),
    assets: z.number().int().nonnegative(),
  }),
  changedHashes: z.array(HashSchema),
  unchangedHashes: z.array(HashSchema),
  deletedPaths: z.array(z.string().min(1)),
  ai: z.object({
    needs: z.array(SyncAiNeedSchema),
  }),
});

export type SyncUploadResponse = z.infer<typeof SyncUploadResponseSchema>;

export const SyncLogEntrySchema = z.object({
  at: IsoDateSchema,
  postCount: z.number().int().nonnegative(),
  changed: z.number().int().nonnegative(),
  deleted: z.number().int().nonnegative(),
});

export type SyncLogEntry = z.infer<typeof SyncLogEntrySchema>;

export const SyncLogResponseSchema = z.object({
  entries: z.array(SyncLogEntrySchema).max(50),
});

export type SyncLogResponse = z.infer<typeof SyncLogResponseSchema>;
