import { z } from "zod";
import { HashSchema, IsoDateSchema } from "./common";

/**
 * Primary 模式（双真相源）契约：
 * - 远程编辑/导入：POST /api/posts（body=PostUpsertRequest，API 解析 frontmatter+hash）
 * - 远程读：GET /api/posts/content/<path> → PostContentResponse
 * - D1→git 导出：GET /api/export（全量快照）→ ExportPayload；POST /api/export/trigger 触发 GitHub repository_dispatch
 */

export const PostSourceSchema = z.enum(["git", "remote"]);

/** 远程编辑/导入请求：整文件内容（含 frontmatter），API 解析索引字段与正文 hash */
export const PostUpsertRequestSchema = z.object({
  path: z.string().regex(/^(?!\/)(?!.*\.\.)(?!.*\/\.)[\p{L}\p{N}_\-/]+\.(md|mdx)$/iu),
  content: z.string().min(10).max(10_000_000),
  source: PostSourceSchema.optional(),
});

export type PostUpsertRequest = z.infer<typeof PostUpsertRequestSchema>;

export const PostUpsertResponseSchema = z.object({
  path: z.string(),
  slug: z.string(),
  title: z.string(),
  draft: z.boolean(),
  categories: z.array(z.string()),
  hash: HashSchema,
  /** 正文 hash 是否变化（变则旧 AI 产物失效） */
  changed: z.boolean(),
  /** 是否已触发 GitHub 导出（github 配置齐全时自动 dispatch） */
  dispatched: z.boolean(),
});

export type PostUpsertResponse = z.infer<typeof PostUpsertResponseSchema>;

export const PostContentResponseSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export type PostContentResponse = z.infer<typeof PostContentResponseSchema>;

export const ExportPostSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export const ExportPayloadSchema = z.object({
  generatedAt: IsoDateSchema,
  posts: z.array(ExportPostSchema),
});

export type ExportPayload = z.infer<typeof ExportPayloadSchema>;

export const ExportTriggerResponseSchema = z.object({
  dispatched: z.boolean(),
  repo: z.string().nullable().optional(),
  error: z.string().optional(),
});

export type ExportTriggerResponse = z.infer<typeof ExportTriggerResponseSchema>;
