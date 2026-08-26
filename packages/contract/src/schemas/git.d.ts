import { z } from "zod";
/**
 * Primary 模式（双真相源）契约：
 * - 远程编辑/导入：POST /api/posts（body=PostUpsertRequest，API 解析 frontmatter+hash）
 * - 远程读：GET /api/posts/content/<path> → PostContentResponse
 * - D1→git 导出：GET /api/export（全量快照）→ ExportPayload；POST /api/export/trigger 触发 GitHub repository_dispatch
 */
export declare const PostSourceSchema: z.ZodEnum<{
    git: "git";
    remote: "remote";
}>;
/** 远程编辑/导入请求：整文件内容（含 frontmatter），API 解析索引字段与正文 hash */
export declare const PostUpsertRequestSchema: z.ZodObject<{
    path: z.ZodString;
    content: z.ZodString;
    source: z.ZodOptional<z.ZodEnum<{
        git: "git";
        remote: "remote";
    }>>;
}, z.core.$strip>;
export type PostUpsertRequest = z.infer<typeof PostUpsertRequestSchema>;
export declare const PostUpsertResponseSchema: z.ZodObject<{
    path: z.ZodString;
    slug: z.ZodString;
    title: z.ZodString;
    draft: z.ZodBoolean;
    categories: z.ZodArray<z.ZodString>;
    hash: z.ZodString;
    changed: z.ZodBoolean;
    dispatched: z.ZodBoolean;
}, z.core.$strip>;
export type PostUpsertResponse = z.infer<typeof PostUpsertResponseSchema>;
export declare const PostContentResponseSchema: z.ZodObject<{
    path: z.ZodString;
    content: z.ZodString;
}, z.core.$strip>;
export type PostContentResponse = z.infer<typeof PostContentResponseSchema>;
export declare const ExportPostSchema: z.ZodObject<{
    path: z.ZodString;
    content: z.ZodString;
}, z.core.$strip>;
export declare const ExportPayloadSchema: z.ZodObject<{
    generatedAt: z.ZodString;
    posts: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        content: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ExportPayload = z.infer<typeof ExportPayloadSchema>;
export declare const ExportTriggerResponseSchema: z.ZodObject<{
    dispatched: z.ZodBoolean;
    repo: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ExportTriggerResponse = z.infer<typeof ExportTriggerResponseSchema>;
