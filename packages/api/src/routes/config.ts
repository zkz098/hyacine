// oxlint-disable typescript/no-unsafe-type-assertion, eslint/no-await-in-loop
import { Hono } from "hono";
import { ConfigUpdateRequestSchema, type EffectiveConfig } from "@hyacine/contract";
import { effectiveConfig, invalidateConfigCache, loadConfigOverrides } from "../utils/config";
import { errorBody, flattenZodError } from "../utils/errors";
import { authMiddleware } from "../middleware/auth";
import { getDb } from "../utils/db";
import type { Env, Variables } from "../types";

/** 有效配置 → GET 响应：敏感段只回 set 标志 */
function toEffective(cfg: ReturnType<typeof effectiveConfig>): EffectiveConfig {
  return {
    aiSummary: {
      endpoint: cfg.aiSummary.endpoint,
      key: { set: cfg.aiSummary.key.length > 0 },
      model: cfg.aiSummary.model,
      provider: cfg.aiSummary.provider,
      autogen: cfg.aiSummary.autogen,
    },
    embedModel: cfg.embedModel,
    embedAutogen: cfg.embedAutogen,
    github: {
      repoOwner: cfg.github.repoOwner,
      repoName: cfg.github.repoName,
      token: { set: cfg.github.token.length > 0 },
    },
    r2: {
      endpoint: cfg.r2.endpoint,
      accessKeyId: cfg.r2.accessKeyId,
      secretAccessKey: { set: cfg.r2.secretAccessKey.length > 0 },
      bucket: cfg.r2.bucket,
    },
    sync: {
      boundProjectId: cfg.sync.boundProjectId,
      maxDeleteRatio: cfg.sync.maxDeleteRatio,
      maxDeleteLimit: cfg.sync.maxDeleteLimit,
    },
  };
}

export function configRoutes(app: Hono<{ Bindings: Env; Variables: Variables }>): void {
  // GET：展示当前生效配置（env + D1 合并），敏感值只回 set 标志
  app.get("/api/admin/config", authMiddleware(["admin"]), async (c) => {
    const db = getDb(c);
    const overrides = await loadConfigOverrides(c.env, db);
    return c.json(toEffective(effectiveConfig(c.env, overrides)));
  });

  // PUT：部分更新。语义：undefined=不变、""=清除、非空=设置
  app.put("/api/admin/config", authMiddleware(["admin"]), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = ConfigUpdateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorBody("validation_error", "参数错误", flattenZodError(parsed.error)), 400);
    }
    const update = parsed.data;
    const pairs: [string, string | undefined][] = [];

    const aiSummary = update.aiSummary;
    if (aiSummary !== undefined) {
      pairs.push(["aiSummary.endpoint", aiSummary.endpoint]);
      pairs.push(["aiSummary.key", aiSummary.key]);
      pairs.push(["aiSummary.model", aiSummary.model]);
      pairs.push(["aiSummary.provider", aiSummary.provider]);
      pairs.push([
        "aiSummary.autogen",
        aiSummary.autogen === undefined ? undefined : String(aiSummary.autogen),
      ]);
    }
    pairs.push(["embedModel", update.embedModel]);
    pairs.push([
      "embedAutogen",
      update.embedAutogen === undefined ? undefined : String(update.embedAutogen),
    ]);
    const github = update.github;
    if (github !== undefined) {
      pairs.push(["github.repoOwner", github.repoOwner]);
      pairs.push(["github.repoName", github.repoName]);
      pairs.push(["github.token", github.token]);
    }
    const r2 = update.r2;
    if (r2 !== undefined) {
      pairs.push(["r2.endpoint", r2.endpoint]);
      pairs.push(["r2.accessKeyId", r2.accessKeyId]);
      pairs.push(["r2.secretAccessKey", r2.secretAccessKey]);
      pairs.push(["r2.bucket", r2.bucket]);
    }
    const sync = update.sync;
    if (sync !== undefined) {
      pairs.push(["sync.boundProjectId", sync.boundProjectId]);
      pairs.push([
        "sync.maxDeleteRatio",
        sync.maxDeleteRatio === undefined ? undefined : String(sync.maxDeleteRatio),
      ]);
      pairs.push([
        "sync.maxDeleteLimit",
        sync.maxDeleteLimit === undefined ? undefined : String(sync.maxDeleteLimit),
      ]);
    }

    const db = getDb(c);
    const changed: { key: string; op: "set" | "clear" }[] = [];
    for (const [key, value] of pairs) {
      if (value === undefined) continue; // 未提供 → 不变
      const normalized = value.trim();
      changed.push({ key, op: normalized.length === 0 ? "clear" : "set" });
      if (normalized.length === 0) {
        await db.prepare("DELETE FROM app_config WHERE key = ?").bind(key).run();
      } else {
        await db
          .prepare(
            "INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
          )
          .bind(key, normalized, new Date().toISOString())
          .run();
      }
    }

    if (changed.length > 0) {
      await invalidateConfigCache(c.env);
    }

    const overrides = await loadConfigOverrides(c.env, db);
    return c.json(toEffective(effectiveConfig(c.env, overrides)));
  });
}
