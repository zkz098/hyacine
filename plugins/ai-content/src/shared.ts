import { HyacineAiClient } from "@hyacine/sdk/ai";

export interface ResolvedAiSummary {
  content: string;
  model: string | null;
}

export interface ResolvedSimilarPost {
  slug: string;
  title: string;
  score: number;
}

export interface AiSummaryInput {
  /** 文章 frontmatter（hyacineArticle context.data） */
  data?: Record<string, unknown> | null;
  /** 文章标识（页面传入 extraProps.postId，网关 hash / 缓存 key） */
  postId?: string;
  /** 文章 markdown 全文（按需生成摘要时需要） */
  postBody?: string;
  enable: boolean;
  apiUrl?: string;
  token?: string;
}

export interface AiSimilarInput {
  data?: Record<string, unknown> | null;
  postId?: string;
  enable: boolean;
  limit: number;
  minSimilarity: number;
  apiUrl?: string;
  token?: string;
}

const summaryCache = new Map<string, ResolvedAiSummary | null>();
const similarCache = new Map<string, ResolvedSimilarPost[]>();
const clientCache = new Map<string, HyacineAiClient | null>();

function readEnvVar(name: string): string | undefined {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
  const metaVal = metaEnv?.[name];
  if (typeof metaVal === "string" && metaVal.trim()) {
    return metaVal.trim();
  }

  const procEnv = (
    globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }
  )?.process?.env;
  const procVal = procEnv?.[name];
  if (typeof procVal === "string" && procVal.trim()) {
    return procVal.trim();
  }

  return undefined;
}

function readApiUrl(): string | undefined {
  return readEnvVar("HYACINE_API_URL");
}

function readToken(): string | undefined {
  return readEnvVar("HYACINE_READ_TOKEN");
}

function getAiClient(
  apiUrl: string | undefined,
  token: string | undefined,
): HyacineAiClient | null {
  const resolvedUrl = apiUrl?.trim() || readApiUrl();
  const resolvedToken = token?.trim() || readToken();
  if (!resolvedUrl) return null;

  const key = `${resolvedUrl}|${resolvedToken ?? ""}`;
  if (!clientCache.has(key)) {
    clientCache.set(key, new HyacineAiClient({ apiUrl: resolvedUrl, token: resolvedToken }));
  }
  return clientCache.get(key) ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

/**
 * 解析单篇文章的 AI 摘要（构建期预计算，含内存缓存）：
 * 1. 优先读取 SDK D1 Loader 注入的 data.ai.summary
 * 2. 其次读取 Frontmatter 物化值（ai_summary / ai_model / summary / aiSummary）
 * 3. 若均无且配置了网关 API 与文章正文，尝试通过 HyacineAiClient 按需获取
 */
export async function resolvePostAiSummary(
  input: AiSummaryInput,
): Promise<ResolvedAiSummary | null> {
  const { data, postId = "", postBody = "", enable } = input;
  if (!enable) return null;

  const record = asRecord(data);
  if (asBoolean(record.encrypted)) return null;

  // 1. SDK 注入值（hyacine 云端 ai 图谱）
  const ai = asRecord(record.ai);
  const aiSummary = asRecord(ai.summary);
  const sdkSummary = asString(aiSummary.summary).trim();
  if (sdkSummary) {
    return {
      content: sdkSummary,
      model: asString(aiSummary.model) || null,
    };
  }

  // 2. Frontmatter 物化值
  const fmSummary =
    asString(record.ai_summary).trim() ||
    asString(record.summary).trim() ||
    asString(record.aiSummary).trim();
  if (fmSummary) {
    return {
      content: fmSummary,
      model: asString(record.ai_model).trim() || null,
    };
  }

  // 3. 按需网关查询（需要文章标识与正文，带内存缓存）
  if (!postId || !postBody) return null;
  if (summaryCache.has(postId)) {
    return summaryCache.get(postId) ?? null;
  }

  const client = getAiClient(input.apiUrl, input.token);
  if (!client) {
    summaryCache.set(postId, null);
    return null;
  }

  try {
    const res = await client.getPostSummary({
      hash: postId,
      content: postBody,
    });
    if (res?.summary) {
      const resolved: ResolvedAiSummary = {
        content: asString(res.summary).trim(),
        model: asString(res.model) || null,
      };
      summaryCache.set(postId, resolved);
      return resolved;
    }
  } catch {
    // 忽略网络或服务异常，安全降级
  }

  summaryCache.set(postId, null);
  return null;
}

/**
 * 解析单篇文章的 AI 相近推荐（构建期预计算，含内存缓存）：
 * 1. 优先读取 SDK 预计算注入的 similarPosts
 * 2. 其次若配置了网关 API，尝试通过 HyacineAiClient 远程查询
 */
export async function resolvePostSimilar(input: AiSimilarInput): Promise<ResolvedSimilarPost[]> {
  const { data, postId = "", enable, limit, minSimilarity } = input;
  if (!enable) return [];

  const record = asRecord(data);
  if (asBoolean(record.encrypted)) return [];

  // 1. SDK 预烘焙数据
  const rawCandidates = Array.isArray(record.similarPosts)
    ? (record.similarPosts as unknown[])
    : Array.isArray(asRecord(record.ai).similarPosts)
      ? (asRecord(record.ai).similarPosts as unknown[])
      : [];

  if (rawCandidates.length > 0) {
    return rawCandidates
      .map((raw) => asRecord(raw))
      .filter((item) => asString(item.slug) !== "" && asString(item.slug) !== postId)
      .map((item) => ({
        slug: asString(item.slug),
        title: asString(item.title),
        score: asNumber(item.score, 0),
      }))
      .filter(
        (item): item is ResolvedSimilarPost =>
          item.slug !== "" && item.title !== "" && item.score >= minSimilarity,
      )
      .toSorted((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // 2. 按需网关查询（带内存缓存）
  if (!postId) return [];
  if (similarCache.has(postId)) {
    return similarCache.get(postId) ?? [];
  }

  const client = getAiClient(input.apiUrl, input.token);
  if (!client) {
    similarCache.set(postId, []);
    return [];
  }

  try {
    const items = await client.getSimilarPosts(postId, {
      limit,
      minSimilarity,
    });
    const mapped: ResolvedSimilarPost[] = items
      .filter((item) => asString(item.slug) !== "" && asString(item.slug) !== postId)
      .map((item) => ({
        slug: asString(item.slug),
        title: asString(item.title),
        score: asNumber(item.score, 0),
      }));
    similarCache.set(postId, mapped);
    return mapped;
  } catch {
    // 忽略异常，降级空列表
  }

  similarCache.set(postId, []);
  return [];
}
