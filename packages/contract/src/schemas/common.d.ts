import { z } from "zod";
/** 内容 hash：十六进制，8~128 位（CLI 侧用 rapidhash-js 或 sha 派生均可） */
export declare const HashSchema: z.ZodString;
export type Hash = z.infer<typeof HashSchema>;
/** 相对内容目录的 post 路径：无前导斜杠、无 ..、以 .md/.mdx 结尾（允许 Unicode 文件名，中文博客必需） */
export declare const PostPathSchema: z.ZodString;
export type PostPath = z.infer<typeof PostPathSchema>;
/** slug：小写字母/数字/连字符（Unicode：保留中文等非拉丁文字） */
export declare const SlugSchema: z.ZodString;
export type Slug = z.infer<typeof SlugSchema>;
/** 分类名 */
export declare const CategoryNameSchema: z.ZodString;
export type CategoryName = z.infer<typeof CategoryNameSchema>;
/** ISO 8601 时间戳（允许时区偏移） */
export declare const IsoDateSchema: z.ZodString;
export type IsoDate = z.infer<typeof IsoDateSchema>;
/** 内容类型 */
export declare const ContentTypeSchema: z.ZodEnum<{
    post: "post";
}>;
export type ContentType = z.infer<typeof ContentTypeSchema>;
/** AI 作用域（token 授权粒度） */
export declare const ScopeSchema: z.ZodEnum<{
    admin: "admin";
    ai: "ai";
    "posts.r": "posts.r";
    "posts.w": "posts.w";
}>;
export type Scope = z.infer<typeof ScopeSchema>;
export declare const SCOPES: readonly Scope[];
/** 错误信封：所有非 2xx 响应体 */
export declare const ApiErrorSchema: z.ZodObject<{
    error: z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        details: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
