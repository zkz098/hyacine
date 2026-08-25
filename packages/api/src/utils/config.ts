import type { CloudConfig } from "@hyacine/contract";
import type { Env } from "../types";

/**
 * 动态配置读取层：env 为默认值，D1 app_config 覆盖。
 * 读取顺序：KV 缓存(app:config:v1, 60s TTL) → miss 时全表加载并回填。
 * 写入侧（routes/config.ts）负责失效 KV。
 */

const CFG_KV_KEY = "app:config:v1";
const CFG_KV_TTL = 60; // 秒；配置变更即时 delete，TTL 只是兜底

/** 解析 KV 缓存值；非对象/含非字符串跳过不信任 */
function parseConfigCache(cached: string): Record<string, string> | null {
  try {
    const data: unknown = JSON.parse(cached);
    if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === "string") map[k] = v;
    }
    return map;
  } catch {
    return null;
  }
}

export async function loadConfigOverrides(env: Env): Promise<Record<string, string>> {
  if (env.CACHE !== undefined) {
    try {
      const cached = await env.CACHE.get(CFG_KV_KEY);
      if (cached !== null && cached.length > 0) {
        const parsed = parseConfigCache(cached);
        if (parsed !== null) return parsed;
      }
    } catch {
      // KV 解析失败继续走 D1
    }
  }

  const rows = await env.DB.prepare("SELECT key, value FROM app_config").all<{
    key: string;
    value: string;
  }>();
  const map: Record<string, string> = {};
  for (const row of rows.results ?? []) {
    map[row.key] = row.value;
  }

  if (env.CACHE !== undefined) {
    try {
      await env.CACHE.put(CFG_KV_KEY, JSON.stringify(map), { expirationTtl: CFG_KV_TTL });
    } catch {
      // 缓存回填失败不阻塞
    }
  }
  return map;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true";
}

/** 合并 env 默认值与 D1 覆盖，产出「有效配置」（空串=未配置） */
export function effectiveConfig(env: Env, overrides: Record<string, string>): CloudConfig {
  return {
    aiSummary: {
      endpoint: overrides["aiSummary.endpoint"] ?? env.AI_SUMMARY_ENDPOINT ?? "",
      key: overrides["aiSummary.key"] ?? env.AI_SUMMARY_KEY ?? "",
      model: overrides["aiSummary.model"] ?? env.AI_SUMMARY_MODEL ?? "",
      provider:
        overrides["aiSummary.provider"] === "workers-ai" ||
        (overrides["aiSummary.provider"] === undefined && env.AI_SUMMARY_PROVIDER === "workers-ai")
          ? ("workers-ai" as const)
          : ("byok" as const),
      autogen: parseBool(overrides["aiSummary.autogen"], false),
    },
    embedModel: overrides["embedModel"] ?? env.EMBED_MODEL ?? "",
    embedAutogen: parseBool(overrides["embedAutogen"], false),
    github: {
      repoOwner: overrides["github.repoOwner"] ?? "",
      repoName: overrides["github.repoName"] ?? "",
      token: overrides["github.token"] ?? "",
    },
    r2: {
      endpoint: overrides["r2.endpoint"] ?? env.R2_S3_ENDPOINT ?? "",
      accessKeyId: overrides["r2.accessKeyId"] ?? env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: overrides["r2.secretAccessKey"] ?? env.R2_SECRET_ACCESS_KEY ?? "",
      bucket: overrides["r2.bucket"] ?? env.R2_BUCKET ?? "",
    },
  };
}

export async function invalidateConfigCache(env: Env): Promise<void> {
  if (env.CACHE === undefined) return;
  try {
    await env.CACHE.delete(CFG_KV_KEY);
  } catch {
    // 幂等：失败依赖 TTL 兜底
  }
}

/** api/token 鉴权外的受保护配置路由用：直接拿覆盖 map + 有效配置 */
export async function loadEffectiveConfig(env: Env): Promise<CloudConfig> {
  const overrides = await loadConfigOverrides(env);
  return effectiveConfig(env, overrides);
}
