import { z } from "zod";
import {
  CategoryNameSchema,
  HashSchema,
  IsoDateSchema,
  PostPathSchema,
  SlugSchema,
} from "./common";

/** frontmatter 已知键（博客主题允许任意扩展键，故 passthrough） */
export const FrontmatterSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    slug: SlugSchema.optional(),
    categories: z.union([CategoryNameSchema, z.array(CategoryNameSchema)]).optional(),
    tags: z.union([z.string(), z.array(z.string().min(1).max(64))]).optional(),
    draft: z.boolean().optional(),
    date: z.string().min(1).optional(),
    updated: z.string().min(1).optional(),
    summary: z.string().min(1).max(2000).optional(),
    summaryModel: z.string().min(1).max(128).optional(),
    summarySourceHash: HashSchema.optional(),
    summaryUpdatedAt: IsoDateSchema.optional(),
    summaryError: z.string().min(1).max(1000).optional(),
  })
  .passthrough();

export type Frontmatter = z.infer<typeof FrontmatterSchema>;

/** 同步上行索引条目：CLI 从 frontmatter 提取，API 落 D1 的派生行 */
export const PostIndexEntrySchema = z.object({
  path: PostPathSchema,
  slug: SlugSchema,
  title: z.string().min(1).max(200),
  draft: z.boolean(),
  categories: z.array(CategoryNameSchema).default([]),
  hash: HashSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
  lastModified: IsoDateSchema,
});

export type PostIndexEntry = z.infer<typeof PostIndexEntrySchema>;

/** 索引条目 + 文件内容：AI 计算时可携带的载荷 */
export const PostContentSchema = PostIndexEntrySchema.extend({
  /** 完整 markdown 文本（含 frontmatter），由 server 剥离 frontmatter 后送 AI */
  content: z.string().min(1),
});

export type PostContent = z.infer<typeof PostContentSchema>;

/** 列表项：索引 + AI 产物状态（console posts 页） */
export const PostAiStatusSchema = z.object({
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

export type PostAiStatus = z.infer<typeof PostAiStatusSchema>;

export const PostListItemSchema = PostIndexEntrySchema.extend({
  ai: PostAiStatusSchema,
});

export type PostListItem = z.infer<typeof PostListItemSchema>;

export const PostsListResponseSchema = z.object({
  posts: z.array(PostListItemSchema),
});

export type PostsListResponse = z.infer<typeof PostsListResponseSchema>;

/** 删除/批量删除文章请求（云端 posts.w） */
export const PostDeleteRequestSchema = z.object({
  paths: z.array(PostPathSchema).min(1).max(500),
});

export type PostDeleteRequest = z.infer<typeof PostDeleteRequestSchema>;

/** 删除/批量删除文章响应 */
export const PostDeleteResponseSchema = z.object({
  deletedCount: z.number().int().nonnegative(),
  deletedPaths: z.array(PostPathSchema),
});

export type PostDeleteResponse = z.infer<typeof PostDeleteResponseSchema>;
