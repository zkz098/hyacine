import { z } from "zod";
import { AiStatusRequestSchema, AiStatusResponseSchema, AiGenerateRequestSchema, AiGenerateResponseSchema, EmbedRequestSchema, EmbedResponseSchema, SimilarRequestSchema, SimilarResponseSchema, SummaryRequestSchema, SummaryResponseSchema } from "./schemas/ai";
import { AssetsListResponseSchema, PresignRequestSchema, PresignResponseSchema, RegisterAssetRequestSchema, RegisterAssetResponseSchema } from "./schemas/asset";
import { HealthResponseSchema, SetupRequestSchema, SetupResponseSchema, SetupStatusSchema, TokenCreateRequestSchema, TokenCreateResponseSchema, TokenListResponseSchema, TokenRevokeResponseSchema } from "./schemas/auth";
import { ConfigUpdateRequestSchema, EffectiveConfigSchema } from "./schemas/config";
import { ExportPayloadSchema, ExportTriggerResponseSchema, PostContentResponseSchema, PostUpsertRequestSchema, PostUpsertResponseSchema } from "./schemas/git";
import { StatsResponseSchema } from "./schemas/stats";
import { PostDeleteRequestSchema, PostDeleteResponseSchema, PostsListResponseSchema } from "./schemas/post";
import { SyncLogResponseSchema, SyncUploadRequestSchema, SyncUploadResponseSchema } from "./schemas/sync";
/** API 错误：HTTP 状态 + 契约错误码 + 详情（CLI 按 code 做 i18n 映射） */
export declare class HyacineApiError extends Error {
    readonly status: number;
    readonly code: string;
    readonly details: unknown;
    constructor(status: number, code: string, message: string, details?: unknown);
}
export interface ClientOptions {
    baseUrl: string;
    token?: string;
    /** 注入 fetch（测试/代理场景）；默认 globalThis.fetch */
    fetch?: typeof fetch;
}
/**
 * 三端共享的类型化 API 客户端。
 * 所有方法：请求体先按契约校验；非 2xx 解析错误信封抛 HyacineApiError；
 * 响应统一按契约校验（v0 不做逃生舱，把伪契约尽早炸在门口）。
 */
export declare class HyacineClient {
    #private;
    constructor(options: ClientOptions);
    setToken(token: string | null): void;
    health(): Promise<z.infer<typeof HealthResponseSchema>>;
    authStatus(): Promise<z.infer<typeof SetupStatusSchema>>;
    setup(req: z.infer<typeof SetupRequestSchema>): Promise<z.infer<typeof SetupResponseSchema>>;
    createToken(req: z.infer<typeof TokenCreateRequestSchema>): Promise<z.infer<typeof TokenCreateResponseSchema>>;
    listTokens(): Promise<z.infer<typeof TokenListResponseSchema>>;
    revokeToken(id: string): Promise<z.infer<typeof TokenRevokeResponseSchema>>;
    syncUpload(req: z.infer<typeof SyncUploadRequestSchema>): Promise<z.infer<typeof SyncUploadResponseSchema>>;
    syncLog(): Promise<z.infer<typeof SyncLogResponseSchema>>;
    getConfig(): Promise<z.infer<typeof EffectiveConfigSchema>>;
    updateConfig(req: z.infer<typeof ConfigUpdateRequestSchema>): Promise<z.infer<typeof EffectiveConfigSchema>>;
    postsList(): Promise<z.infer<typeof PostsListResponseSchema>>;
    deletePosts(req: z.infer<typeof PostDeleteRequestSchema>): Promise<z.infer<typeof PostDeleteResponseSchema>>;
    generateAi(req: z.infer<typeof AiGenerateRequestSchema>): Promise<z.infer<typeof AiGenerateResponseSchema>>;
    aiSummary(req: z.infer<typeof SummaryRequestSchema>): Promise<z.infer<typeof SummaryResponseSchema>>;
    aiEmbed(req: z.infer<typeof EmbedRequestSchema>): Promise<z.infer<typeof EmbedResponseSchema>>;
    aiSimilar(req: z.infer<typeof SimilarRequestSchema>): Promise<z.infer<typeof SimilarResponseSchema>>;
    aiStatus(req: z.infer<typeof AiStatusRequestSchema>): Promise<z.infer<typeof AiStatusResponseSchema>>;
    getPostContent(path: string): Promise<z.infer<typeof PostContentResponseSchema>>;
    upsertPost(req: z.infer<typeof PostUpsertRequestSchema>): Promise<z.infer<typeof PostUpsertResponseSchema>>;
    exportSnapshot(): Promise<z.infer<typeof ExportPayloadSchema>>;
    triggerExport(): Promise<z.infer<typeof ExportTriggerResponseSchema>>;
    presign(req: z.infer<typeof PresignRequestSchema>): Promise<z.infer<typeof PresignResponseSchema>>;
    registerAsset(req: z.infer<typeof RegisterAssetRequestSchema>): Promise<z.infer<typeof RegisterAssetResponseSchema>>;
    assetsList(): Promise<z.infer<typeof AssetsListResponseSchema>>;
    stats(): Promise<z.infer<typeof StatsResponseSchema>>;
}
