import { z } from "zod";

/** 内容 hash：十六进制，8~128 位（CLI 侧用 rapidhash-js 或 sha 派生均可） */
export const HashSchema = z.string().regex(/^[0-9a-f]{8,128}$/i);

export type Hash = z.infer<typeof HashSchema>;

/** 相对内容目录的 post 路径：无前导斜杠、无 ..、以 .md/.mdx 结尾 */
export const PostPathSchema = z
  .string()
  .regex(/^(?!\/)(?!.*\.\.)(?!.*\/\.)[a-zA-Z0-9_\-/]+\.(md|mdx)$/i);

export type PostPath = z.infer<typeof PostPathSchema>;

/** slug：小写字母/数字/连字符 */
export const SlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i);

export type Slug = z.infer<typeof SlugSchema>;

/** 分类名 */
export const CategoryNameSchema = z.string().min(1).max(64);

export type CategoryName = z.infer<typeof CategoryNameSchema>;

/** ISO 8601 时间戳（允许时区偏移） */
export const IsoDateSchema = z.string().datetime({ offset: true });

export type IsoDate = z.infer<typeof IsoDateSchema>;

/** 内容类型 */
export const ContentTypeSchema = z.enum(["post"]);

export type ContentType = z.infer<typeof ContentTypeSchema>;

/** AI 作用域（token 授权粒度） */
export const ScopeSchema = z.enum(["posts.r", "posts.w", "ai", "admin"]);

export type Scope = z.infer<typeof ScopeSchema>;

export const SCOPES: readonly Scope[] = ["posts.r", "posts.w", "ai", "admin"];

/** 错误信封：所有非 2xx 响应体 */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
