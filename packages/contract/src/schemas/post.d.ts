import { z } from "zod";
/** frontmatter 已知键（博客主题允许任意扩展键，故 passthrough） */
export declare const FrontmatterSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    categories: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    tags: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
    draft: z.ZodOptional<z.ZodBoolean>;
    date: z.ZodOptional<z.ZodString>;
    updated: z.ZodOptional<z.ZodString>;
    summary: z.ZodOptional<z.ZodString>;
    summaryModel: z.ZodOptional<z.ZodString>;
    summarySourceHash: z.ZodOptional<z.ZodString>;
    summaryUpdatedAt: z.ZodOptional<z.ZodString>;
    summaryError: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export type Frontmatter = z.infer<typeof FrontmatterSchema>;
/** 同步上行索引条目：CLI 从 frontmatter 提取，API 落 D1 的派生行 */
export declare const PostIndexEntrySchema: z.ZodObject<{
    path: z.ZodString;
    slug: z.ZodString;
    title: z.ZodString;
    draft: z.ZodBoolean;
    categories: z.ZodDefault<z.ZodArray<z.ZodString>>;
    hash: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    lastModified: z.ZodString;
}, z.core.$strip>;
export type PostIndexEntry = z.infer<typeof PostIndexEntrySchema>;
/** 索引条目 + 文件内容：AI 计算时可携带的载荷 */
export declare const PostContentSchema: z.ZodObject<{
    path: z.ZodString;
    slug: z.ZodString;
    title: z.ZodString;
    draft: z.ZodBoolean;
    categories: z.ZodDefault<z.ZodArray<z.ZodString>>;
    hash: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    lastModified: z.ZodString;
    content: z.ZodString;
}, z.core.$strip>;
export type PostContent = z.infer<typeof PostContentSchema>;
/** 列表项：索引 + AI 产物状态（console posts 页） */
export declare const PostAiStatusSchema: z.ZodObject<{
    summary: z.ZodObject<{
        present: z.ZodBoolean;
        model: z.ZodNullable<z.ZodString>;
        at: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
    embed: z.ZodObject<{
        present: z.ZodBoolean;
        model: z.ZodNullable<z.ZodString>;
        at: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type PostAiStatus = z.infer<typeof PostAiStatusSchema>;
export declare const PostListItemSchema: z.ZodObject<{
    path: z.ZodString;
    slug: z.ZodString;
    title: z.ZodString;
    draft: z.ZodBoolean;
    categories: z.ZodDefault<z.ZodArray<z.ZodString>>;
    hash: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    lastModified: z.ZodString;
    ai: z.ZodObject<{
        summary: z.ZodObject<{
            present: z.ZodBoolean;
            model: z.ZodNullable<z.ZodString>;
            at: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
        embed: z.ZodObject<{
            present: z.ZodBoolean;
            model: z.ZodNullable<z.ZodString>;
            at: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type PostListItem = z.infer<typeof PostListItemSchema>;
export declare const PostsListResponseSchema: z.ZodObject<{
    posts: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        slug: z.ZodString;
        title: z.ZodString;
        draft: z.ZodBoolean;
        categories: z.ZodDefault<z.ZodArray<z.ZodString>>;
        hash: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        lastModified: z.ZodString;
        ai: z.ZodObject<{
            summary: z.ZodObject<{
                present: z.ZodBoolean;
                model: z.ZodNullable<z.ZodString>;
                at: z.ZodNullable<z.ZodString>;
            }, z.core.$strip>;
            embed: z.ZodObject<{
                present: z.ZodBoolean;
                model: z.ZodNullable<z.ZodString>;
                at: z.ZodNullable<z.ZodString>;
            }, z.core.$strip>;
        }, z.core.$strip>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type PostsListResponse = z.infer<typeof PostsListResponseSchema>;
/** 删除/批量删除文章请求（云端 posts.w） */
export declare const PostDeleteRequestSchema: z.ZodObject<{
    paths: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type PostDeleteRequest = z.infer<typeof PostDeleteRequestSchema>;
/** 删除/批量删除文章响应 */
export declare const PostDeleteResponseSchema: z.ZodObject<{
    deletedCount: z.ZodNumber;
    deletedPaths: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type PostDeleteResponse = z.infer<typeof PostDeleteResponseSchema>;
