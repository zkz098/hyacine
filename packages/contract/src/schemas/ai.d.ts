import { z } from "zod";
/** 手动「立刻生成摘要/嵌入」：按 post 路径，kinds 默认两者 */
export declare const AiGenerateRequestSchema: z.ZodObject<{
    path: z.ZodString;
    kinds: z.ZodDefault<z.ZodArray<z.ZodEnum<{
        embed: "embed";
        summary: "summary";
    }>>>;
}, z.core.$strip>;
export type AiGenerateRequest = z.infer<typeof AiGenerateRequestSchema>;
export declare const AiGenerateResponseSchema: z.ZodObject<{
    hash: z.ZodString;
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
    errors: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type AiGenerateResponse = z.infer<typeof AiGenerateResponseSchema>;
/** 摘要请求：client 传全文，server 剥离 frontmatter 后送 BYOK 端点 */
export declare const SummaryRequestSchema: z.ZodObject<{
    hash: z.ZodString;
    content: z.ZodString;
    model: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SummaryRequest = z.infer<typeof SummaryRequestSchema>;
export declare const SummaryResponseSchema: z.ZodObject<{
    hash: z.ZodString;
    summary: z.ZodString;
    model: z.ZodString;
    sourceHash: z.ZodString;
}, z.core.$strip>;
export type SummaryResponse = z.infer<typeof SummaryResponseSchema>;
/** 嵌入请求：chunk 切分在 client（本地重活），server 只调 Workers AI */
export declare const EmbedRequestSchema: z.ZodObject<{
    hash: z.ZodString;
    chunks: z.ZodArray<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type EmbedRequest = z.infer<typeof EmbedRequestSchema>;
export declare const EmbedResponseSchema: z.ZodObject<{
    hash: z.ZodString;
    model: z.ZodString;
    dim: z.ZodNumber;
    chunkCount: z.ZodNumber;
}, z.core.$strip>;
export type EmbedResponse = z.infer<typeof EmbedResponseSchema>;
/** 相似度查询：向量已存 server（D1 blob），全表 cosine */
export declare const SimilarRequestSchema: z.ZodObject<{
    hash: z.ZodString;
    limit: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type SimilarRequest = z.infer<typeof SimilarRequestSchema>;
export declare const SimilarItemSchema: z.ZodObject<{
    path: z.ZodString;
    slug: z.ZodString;
    title: z.ZodString;
    score: z.ZodNumber;
}, z.core.$strip>;
export type SimilarItem = z.infer<typeof SimilarItemSchema>;
export declare const SimilarResponseSchema: z.ZodObject<{
    query: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        slug: z.ZodString;
        title: z.ZodString;
        score: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type SimilarResponse = z.infer<typeof SimilarResponseSchema>;
/** 单个 hash 的 AI 产物状态（materialize 前查询） */
export declare const AiStatusEntrySchema: z.ZodObject<{
    hash: z.ZodString;
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
export type AiStatusEntry = z.infer<typeof AiStatusEntrySchema>;
export declare const AiStatusRequestSchema: z.ZodObject<{
    hashes: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export type AiStatusRequest = z.infer<typeof AiStatusRequestSchema>;
export declare const AiStatusResponseSchema: z.ZodObject<{
    entries: z.ZodArray<z.ZodObject<{
        hash: z.ZodString;
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
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AiStatusResponse = z.infer<typeof AiStatusResponseSchema>;
