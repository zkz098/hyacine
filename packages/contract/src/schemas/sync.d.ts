import { z } from "zod";
/** 同步上行条目：索引 + 可选正文（带 content 时 API 落 posts.content，解锁自动 AI/Primary） */
export declare const SyncPostSchema: z.ZodObject<{
    path: z.ZodString;
    slug: z.ZodString;
    title: z.ZodString;
    draft: z.ZodBoolean;
    categories: z.ZodDefault<z.ZodArray<z.ZodString>>;
    hash: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    lastModified: z.ZodString;
    content: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SyncPost = z.infer<typeof SyncPostSchema>;
/** 索引上行（全量快照，server 按 hash diff） */
export declare const SyncUploadRequestSchema: z.ZodObject<{
    generatedAt: z.ZodString;
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
        content: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    assets: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        isRemote: z.ZodBoolean;
        assetType: z.ZodEnum<{
            audio: "audio";
            font: "font";
            image: "image";
            other: "other";
            video: "video";
        }>;
        fileType: z.ZodString;
        checksum: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        r2Key: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        size: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
    deletedPaths: z.ZodDefault<z.ZodArray<z.ZodString>>;
    projectId: z.ZodOptional<z.ZodString>;
    force: z.ZodOptional<z.ZodBoolean>;
    rebindProject: z.ZodOptional<z.ZodBoolean>;
    allowBatchDelete: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type SyncUploadRequest = z.infer<typeof SyncUploadRequestSchema>;
/** server 判定哪个 hash 缺哪类 AI 产物 */
export declare const SyncAiNeedSchema: z.ZodObject<{
    hash: z.ZodString;
    path: z.ZodString;
    reason: z.ZodEnum<{
        both: "both";
        embed: "embed";
        summary: "summary";
    }>;
}, z.core.$strip>;
export type SyncAiNeed = z.infer<typeof SyncAiNeedSchema>;
export declare const SyncUploadResponseSchema: z.ZodObject<{
    accepted: z.ZodObject<{
        posts: z.ZodNumber;
        assets: z.ZodNumber;
    }, z.core.$strip>;
    changedHashes: z.ZodArray<z.ZodString>;
    unchangedHashes: z.ZodArray<z.ZodString>;
    deletedPaths: z.ZodArray<z.ZodString>;
    ai: z.ZodObject<{
        needs: z.ZodArray<z.ZodObject<{
            hash: z.ZodString;
            path: z.ZodString;
            reason: z.ZodEnum<{
                both: "both";
                embed: "embed";
                summary: "summary";
            }>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type SyncUploadResponse = z.infer<typeof SyncUploadResponseSchema>;
export declare const SyncLogEntrySchema: z.ZodObject<{
    at: z.ZodString;
    postCount: z.ZodNumber;
    changed: z.ZodNumber;
    deleted: z.ZodNumber;
}, z.core.$strip>;
export type SyncLogEntry = z.infer<typeof SyncLogEntrySchema>;
export declare const SyncLogResponseSchema: z.ZodObject<{
    entries: z.ZodArray<z.ZodObject<{
        at: z.ZodString;
        postCount: z.ZodNumber;
        changed: z.ZodNumber;
        deleted: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type SyncLogResponse = z.infer<typeof SyncLogResponseSchema>;
