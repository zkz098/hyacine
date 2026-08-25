import { z } from "zod";
import { ApiErrorSchema } from "./schemas/common";
import {
  AiStatusRequestSchema,
  AiStatusResponseSchema,
  AiGenerateRequestSchema,
  AiGenerateResponseSchema,
  EmbedRequestSchema,
  EmbedResponseSchema,
  SimilarRequestSchema,
  SimilarResponseSchema,
  SummaryRequestSchema,
  SummaryResponseSchema,
} from "./schemas/ai";
import {
  AssetsListResponseSchema,
  PresignRequestSchema,
  PresignResponseSchema,
  RegisterAssetRequestSchema,
  RegisterAssetResponseSchema,
} from "./schemas/asset";
import {
  HealthResponseSchema,
  SetupRequestSchema,
  SetupResponseSchema,
  SetupStatusSchema,
  TokenCreateRequestSchema,
  TokenCreateResponseSchema,
  TokenListResponseSchema,
  TokenRevokeResponseSchema,
} from "./schemas/auth";
import { ConfigUpdateRequestSchema, EffectiveConfigSchema } from "./schemas/config";
import {
  ExportPayloadSchema,
  ExportTriggerResponseSchema,
  PostContentResponseSchema,
  PostUpsertRequestSchema,
  PostUpsertResponseSchema,
} from "./schemas/git";
import { StatsResponseSchema } from "./schemas/stats";
import { PostsListResponseSchema } from "./schemas/post";
import {
  SyncLogResponseSchema,
  SyncUploadRequestSchema,
  SyncUploadResponseSchema,
} from "./schemas/sync";

/** API 错误：HTTP 状态 + 契约错误码 + 详情（CLI 按 code 做 i18n 映射） */
export class HyacineApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HyacineApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ClientOptions {
  baseUrl: string;
  token?: string;
  /** 注入 fetch（测试/代理场景）；默认 globalThis.fetch */
  fetch?: typeof fetch;
}

type AnyZodSchema = z.ZodType;

/**
 * 三端共享的类型化 API 客户端。
 * 所有方法：请求体先按契约校验；非 2xx 解析错误信封抛 HyacineApiError；
 * 响应统一按契约校验（v0 不做逃生舱，把伪契约尽早炸在门口）。
 */
export class HyacineClient {
  #baseUrl: string;
  #token: string | null;
  #fetch: typeof fetch;

  constructor(options: ClientOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.#token = options.token ?? null;
    this.#fetch = options.fetch ?? ((...args) => fetch(...args));
  }

  setToken(token: string | null): void {
    this.#token = token;
  }

  // ---- auth -----------------------------------------------------------

  async health(): Promise<z.infer<typeof HealthResponseSchema>> {
    return this.#request(HealthResponseSchema, "GET", "/api/health");
  }

  async authStatus(): Promise<z.infer<typeof SetupStatusSchema>> {
    return this.#request(SetupStatusSchema, "GET", "/api/auth/setup");
  }

  async setup(
    req: z.infer<typeof SetupRequestSchema>,
  ): Promise<z.infer<typeof SetupResponseSchema>> {
    return this.#request(SetupResponseSchema, "POST", "/api/auth/setup", req, SetupRequestSchema);
  }

  async createToken(
    req: z.infer<typeof TokenCreateRequestSchema>,
  ): Promise<z.infer<typeof TokenCreateResponseSchema>> {
    return this.#request(
      TokenCreateResponseSchema,
      "POST",
      "/api/auth/tokens",
      req,
      TokenCreateRequestSchema,
    );
  }

  async listTokens(): Promise<z.infer<typeof TokenListResponseSchema>> {
    return this.#request(TokenListResponseSchema, "GET", "/api/auth/tokens");
  }

  async revokeToken(id: string): Promise<z.infer<typeof TokenRevokeResponseSchema>> {
    return this.#request(
      TokenRevokeResponseSchema,
      "POST",
      `/api/auth/tokens/${encodeURIComponent(id)}/revoke`,
    );
  }

  // ---- sync -----------------------------------------------------------

  async syncUpload(
    req: z.infer<typeof SyncUploadRequestSchema>,
  ): Promise<z.infer<typeof SyncUploadResponseSchema>> {
    return this.#request(
      SyncUploadResponseSchema,
      "POST",
      "/api/sync",
      req,
      SyncUploadRequestSchema,
    );
  }

  async syncLog(): Promise<z.infer<typeof SyncLogResponseSchema>> {
    return this.#request(SyncLogResponseSchema, "GET", "/api/sync/log");
  }

  // ---- config（服务级动态配置，admin） -----------------------------------

  async getConfig(): Promise<z.infer<typeof EffectiveConfigSchema>> {
    return this.#request(EffectiveConfigSchema, "GET", "/api/admin/config");
  }

  async updateConfig(
    req: z.infer<typeof ConfigUpdateRequestSchema>,
  ): Promise<z.infer<typeof EffectiveConfigSchema>> {
    return this.#request(
      EffectiveConfigSchema,
      "PUT",
      "/api/admin/config",
      req,
      ConfigUpdateRequestSchema,
    );
  }

  // ---- posts 查询 -------------------------------------------------------

  async postsList(): Promise<z.infer<typeof PostsListResponseSchema>> {
    return this.#request(PostsListResponseSchema, "GET", "/api/posts");
  }

  // ---- ai -------------------------------------------------------------

  async generateAi(
    req: z.infer<typeof AiGenerateRequestSchema>,
  ): Promise<z.infer<typeof AiGenerateResponseSchema>> {
    return this.#request(
      AiGenerateResponseSchema,
      "POST",
      "/api/ai/generate",
      req,
      AiGenerateRequestSchema,
    );
  }

  async aiSummary(
    req: z.infer<typeof SummaryRequestSchema>,
  ): Promise<z.infer<typeof SummaryResponseSchema>> {
    return this.#request(
      SummaryResponseSchema,
      "POST",
      "/api/ai/summary",
      req,
      SummaryRequestSchema,
    );
  }

  async aiEmbed(
    req: z.infer<typeof EmbedRequestSchema>,
  ): Promise<z.infer<typeof EmbedResponseSchema>> {
    return this.#request(EmbedResponseSchema, "POST", "/api/ai/embed", req, EmbedRequestSchema);
  }

  async aiSimilar(
    req: z.infer<typeof SimilarRequestSchema>,
  ): Promise<z.infer<typeof SimilarResponseSchema>> {
    return this.#request(
      SimilarResponseSchema,
      "POST",
      "/api/ai/similar",
      req,
      SimilarRequestSchema,
    );
  }

  async aiStatus(
    req: z.infer<typeof AiStatusRequestSchema>,
  ): Promise<z.infer<typeof AiStatusResponseSchema>> {
    return this.#request(
      AiStatusResponseSchema,
      "POST",
      "/api/ai/status",
      req,
      AiStatusRequestSchema,
    );
  }

  // ---- posts 远程编辑 / Primary 导出 --------------------------------------

  async getPostContent(path: string): Promise<z.infer<typeof PostContentResponseSchema>> {
    return this.#request(
      PostContentResponseSchema,
      "GET",
      `/api/posts/content?path=${encodeURIComponent(path)}`,
    );
  }

  async upsertPost(
    req: z.infer<typeof PostUpsertRequestSchema>,
  ): Promise<z.infer<typeof PostUpsertResponseSchema>> {
    return this.#request(
      PostUpsertResponseSchema,
      "POST",
      "/api/posts",
      req,
      PostUpsertRequestSchema,
    );
  }

  async exportSnapshot(): Promise<z.infer<typeof ExportPayloadSchema>> {
    return this.#request(ExportPayloadSchema, "GET", "/api/export");
  }

  async triggerExport(): Promise<z.infer<typeof ExportTriggerResponseSchema>> {
    return this.#request(ExportTriggerResponseSchema, "POST", "/api/export/trigger");
  }

  // ---- assets ----------------------------------------------------------

  async presign(
    req: z.infer<typeof PresignRequestSchema>,
  ): Promise<z.infer<typeof PresignResponseSchema>> {
    return this.#request(
      PresignResponseSchema,
      "POST",
      "/api/assets/presign",
      req,
      PresignRequestSchema,
    );
  }

  async registerAsset(
    req: z.infer<typeof RegisterAssetRequestSchema>,
  ): Promise<z.infer<typeof RegisterAssetResponseSchema>> {
    return this.#request(
      RegisterAssetResponseSchema,
      "POST",
      "/api/assets/register",
      req,
      RegisterAssetRequestSchema,
    );
  }

  async assetsList(): Promise<z.infer<typeof AssetsListResponseSchema>> {
    return this.#request(AssetsListResponseSchema, "GET", "/api/assets");
  }

  // ---- stats -----------------------------------------------------------

  async stats(): Promise<z.infer<typeof StatsResponseSchema>> {
    return this.#request(StatsResponseSchema, "GET", "/api/stats");
  }

  // ---- internals -------------------------------------------------------

  async #request<T>(
    schema: z.ZodType<T>,
    method: string,
    path: string,
    body?: unknown,
    bodySchema?: AnyZodSchema,
  ): Promise<T> {
    const url = `${this.#baseUrl}${path}`;
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.#token !== null) {
      headers.authorization = `Bearer ${this.#token}`;
    }
    if (body !== undefined) {
      headers["content-type"] = "application/json";
    }
    if (bodySchema !== undefined) {
      body = bodySchema.parse(body);
    }

    let response: Response;
    try {
      response = await this.#fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (cause) {
      throw new HyacineApiError(0, "network_error", `无法连接 API: ${String(cause)}`, { cause });
    }

    const payload = await this.#parsePayload(response);
    if (!response.ok) {
      const parsed = ApiErrorSchema.safeParse(payload);
      if (parsed.success) {
        throw new HyacineApiError(
          response.status,
          parsed.data.error.code,
          parsed.data.error.message,
          parsed.data.error.details,
        );
      }
      throw new HyacineApiError(
        response.status,
        "http_error",
        `HTTP ${response.status} ${response.statusText}`,
      );
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new HyacineApiError(
        response.status,
        "invalid_response",
        `响应不符合契约: ${parsed.error.message}`,
        {
          issues: parsed.error.issues,
        },
      );
    }
    return parsed.data;
  }

  async #parsePayload(response: Response): Promise<unknown> {
    const text = await response.text();
    if (text.length === 0) {
      return null;
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { error: { code: "non_json", message: `响应非 JSON: ${text.slice(0, 200)}` } };
    }
  }
}
