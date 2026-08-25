import { z } from "zod";
import { HashSchema, IsoDateSchema, PostPathSchema, SlugSchema } from "./common";

/** 手动「立刻生成摘要/嵌入」：按 post 路径，kinds 默认两者 */
export const AiGenerateRequestSchema = z.object({
  path: z.string().min(1).max(1024),
  kinds: z.array(z.enum(["summary", "embed"])).default(["summary", "embed"]),
});

export type AiGenerateRequest = z.infer<typeof AiGenerateRequestSchema>;

export const AiGenerateResponseSchema = z.object({
  hash: HashSchema,
  summary: z.object({
    present: z.boolean(),
    model: z.string().nullable(),
    at: IsoDateSchema.nullable(),
  }),
  embed: z.object({
    present: z.boolean(),
    model: z.string().nullable(),
    at: IsoDateSchema.nullable(),
  }),
  errors: z.array(z.string()).default([]),
});

export type AiGenerateResponse = z.infer<typeof AiGenerateResponseSchema>;

/** 摘要请求：client 传全文，server 剥离 frontmatter 后送 BYOK 端点 */
export const SummaryRequestSchema = z.object({
  hash: HashSchema,
  content: z.string().min(1),
  model: z.string().min(1).max(128).optional(),
});

export type SummaryRequest = z.infer<typeof SummaryRequestSchema>;

export const SummaryResponseSchema = z.object({
  hash: HashSchema,
  summary: z.string().min(1),
  model: z.string(),
  sourceHash: HashSchema,
});

export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;

/** 嵌入请求：chunk 切分在 client（本地重活），server 只调 Workers AI */
export const EmbedRequestSchema = z.object({
  hash: HashSchema,
  chunks: z.array(z.string().min(1)).min(1).max(256),
  model: z.string().min(1).max(128).optional(),
});

export type EmbedRequest = z.infer<typeof EmbedRequestSchema>;

export const EmbedResponseSchema = z.object({
  hash: HashSchema,
  model: z.string(),
  dim: z.number().int().positive(),
  chunkCount: z.number().int().positive(),
});

export type EmbedResponse = z.infer<typeof EmbedResponseSchema>;

/** 相似度查询：向量已存 server（D1 blob），全表 cosine */
export const SimilarRequestSchema = z.object({
  hash: HashSchema,
  limit: z.number().int().min(1).max(20).default(5),
});

export type SimilarRequest = z.infer<typeof SimilarRequestSchema>;

export const SimilarItemSchema = z.object({
  path: PostPathSchema,
  slug: SlugSchema,
  title: z.string(),
  score: z.number().min(-1).max(1),
});

export type SimilarItem = z.infer<typeof SimilarItemSchema>;

export const SimilarResponseSchema = z.object({
  query: HashSchema,
  items: z.array(SimilarItemSchema),
});

export type SimilarResponse = z.infer<typeof SimilarResponseSchema>;

/** 单个 hash 的 AI 产物状态（materialize 前查询） */
export const AiStatusEntrySchema = z.object({
  hash: HashSchema,
  summary: z.object({
    present: z.boolean(),
    model: z.string().nullable(),
    at: IsoDateSchema.nullable(),
  }),
  embed: z.object({
    present: z.boolean(),
    model: z.string().nullable(),
    at: IsoDateSchema.nullable(),
  }),
});

export type AiStatusEntry = z.infer<typeof AiStatusEntrySchema>;

export const AiStatusRequestSchema = z.object({
  hashes: z.array(HashSchema).min(1).max(500),
});

export type AiStatusRequest = z.infer<typeof AiStatusRequestSchema>;

export const AiStatusResponseSchema = z.object({
  entries: z.array(AiStatusEntrySchema),
});

export type AiStatusResponse = z.infer<typeof AiStatusResponseSchema>;
