// oxlint-disable typescript/no-unsafe-type-assertion, typescript/no-unnecessary-type-assertion, eslint/no-await-in-loop
import { Hono } from "hono";
import {
  AiGenerateRequestSchema,
  AiStatusRequestSchema,
  EmbedRequestSchema,
  SimilarRequestSchema,
  SummaryRequestSchema,
} from "@hyacine/contract";
import { cosine, meanPool, stripFrontmatter } from "../utils/crypto";
import { errorBody, flattenZodError } from "../utils/errors";
import { defer } from "../utils/defer";
import { loadEffectiveConfig } from "../utils/config";
import {
  chunkText,
  EMBED_DEFAULT_MODEL,
  generateSummaryByok,
  generateSummaryWorkersAi,
  generateEmbed,
  storeEmbedResult,
  storeSummaryResult,
} from "../utils/aiQueue";
import { authMiddleware } from "../middleware/auth";
import { getDb } from "../utils/db";
import type { Env, Variables } from "../types";

export function aiRoutes(app: Hono<{ Bindings: Env; Variables: Variables }>): void {
  // 手动「立刻生成摘要/嵌入」：按 post 路径即时而同步生成（绕过队列，供管理台按钮）
  app.post("/api/ai/generate", authMiddleware(["ai"]), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = AiGenerateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorBody("validation_error", "参数错误", flattenZodError(parsed.error)), 400);
    }
    const { path, kinds } = parsed.data;
    const db = getDb(c);
    const row = await db
      .prepare("SELECT hash, content FROM posts WHERE path = ?")
      .bind(path)
      .first<{ hash: string; content: string | null }>();
    if (row === null || row === undefined || row.content === null) {
      return c.json(errorBody("not_found", "文章无正文（请先同步/上传正文到 D1）"), 404);
    }

    const cfg = await loadEffectiveConfig(c.env, db);
    const summaryModel = cfg.aiSummary.model.length > 0 ? cfg.aiSummary.model : "";
    const embedModel = cfg.embedModel.length > 0 ? cfg.embedModel : EMBED_DEFAULT_MODEL;
    const errors: string[] = [];
    const now = new Date();
    const stripped = stripFrontmatter(row.content);

    if (kinds.includes("summary")) {
      try {
        if (cfg.aiSummary.provider === "workers-ai") {
          const summary = await generateSummaryWorkersAi(
            c.env,
            summaryModel || "@cf/meta/llama-3.2-3b-instruct",
            stripped,
          );
          await storeSummaryResult(
            c.env,
            row.hash,
            summary,
            summaryModel || "@cf/meta/llama-3.2-3b-instruct",
            now,
            db,
          );
        } else {
          if (cfg.aiSummary.endpoint.length === 0 || cfg.aiSummary.key.length === 0) {
            errors.push("摘要：未配置 AI 摘要端点");
          } else {
            const summary = await generateSummaryByok(
              cfg.aiSummary.endpoint,
              cfg.aiSummary.key,
              summaryModel,
              stripped,
            );
            await storeSummaryResult(c.env, row.hash, summary, summaryModel, now, db);
          }
        }
      } catch (error) {
        errors.push(`摘要: ${String(error)}`);
      }
    }

    if (kinds.includes("embed")) {
      try {
        const vector = await generateEmbed(c.env, embedModel, stripped);
        await storeEmbedResult(
          c.env,
          row.hash,
          embedModel,
          now,
          vector,
          chunkText(stripped).length,
          db,
        );
      } catch (error) {
        errors.push(`嵌入: ${String(error)}`);
      }
    }

    const result = await db
      .prepare(
        "SELECT summary, summary_model, summary_at, embed_model, embed_at, embed_vec FROM ai_results WHERE hash = ?",
      )
      .bind(row.hash)
      .first<{
        summary: string | null;
        summary_model: string | null;
        summary_at: string | null;
        embed_model: string | null;
        embed_at: string | null;
        embed_vec: string | null;
      }>();
    return c.json({
      hash: row.hash,
      summary: {
        present: result !== null && result.summary !== null && result.summary.length > 0,
        model: result?.summary_model ?? null,
        at: result?.summary_at ?? null,
      },
      embed: {
        present: result !== null && result.embed_vec !== null && result.embed_vec.length > 0,
        model: result?.embed_model ?? null,
        at: result?.embed_at ?? null,
      },
      errors,
    });
  });

  app.post("/api/ai/summary", authMiddleware(["ai"]), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = SummaryRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorBody("validation_error", "参数错误", flattenZodError(parsed.error)), 400);
    }

    const { hash, content, model } = parsed.data;

    const db = getDb(c);
    const cfg = await loadEffectiveConfig(c.env, db);
    const endpoint = cfg.aiSummary.endpoint;
    const key = cfg.aiSummary.key;
    const configuredModel = cfg.aiSummary.model;
    const usedModel = model ?? configuredModel ?? "unknown";

    // KV cache check: try D1 first
    const existing = await db
      .prepare("SELECT summary, summary_model, summary_at FROM ai_results WHERE hash = ?")
      .bind(hash)
      .first<{ summary: string | null; summary_model: string | null; summary_at: string | null }>();
    if (existing !== null && existing !== undefined && existing.summary !== null) {
      if (existing.summary_model === usedModel) {
        return c.json({ hash, summary: existing.summary, model: usedModel, sourceHash: hash });
      }
    }

    // KV 缓存读取：D1 未命中时查 KV，命中直接返回（缓存键含模型，避免跨模型误命中）
    if (c.env.CACHE !== undefined) {
      try {
        const kvValue = await c.env.CACHE.get(`ai:${hash}:${usedModel}`);
        if (kvValue !== null && kvValue.length > 0) {
          return c.json({ hash, summary: kvValue, model: usedModel, sourceHash: hash });
        }
      } catch {
        // ignore KV errors
      }
    }

    const stripped = stripFrontmatter(content);

    // Provider 分流：byok=OpenAI 兼容端点；workers-ai=Workers AI（与自动队列共享生成函数）
    let summaryText: string;
    try {
      if (cfg.aiSummary.provider === "workers-ai") {
        if (c.env.AI === undefined) {
          return c.json(errorBody("ai_not_configured", "Workers AI 未绑定"), 503);
        }
        summaryText = await generateSummaryWorkersAi(c.env, usedModel, stripped);
      } else {
        if (endpoint.length === 0 || key.length === 0) {
          return c.json(errorBody("ai_not_configured", "未配置 AI 摘要端点"), 503);
        }
        summaryText = await generateSummaryByok(endpoint, key, usedModel, stripped);
      }
    } catch (error) {
      return c.json(errorBody("ai_failed", `AI 调用异常: ${String(error)}`), 502);
    }

    const now = new Date().toISOString();
    await storeSummaryResult(c.env, hash, summaryText, usedModel, new Date(now), db);

    // KV 缓存写入：defer（线上 waitUntil）保证落盘，floating promise 会被丢弃
    if (c.env.CACHE !== undefined) {
      defer(
        c,
        c.env.CACHE.put(`ai:${hash}:${usedModel}`, summaryText, {
          expirationTtl: 7 * 24 * 3600,
        }).catch(() => {
          // ignore
        }),
      );
    }

    return c.json({ hash, summary: summaryText, model: usedModel, sourceHash: hash });
  });

  app.post("/api/ai/embed", authMiddleware(["ai"]), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = EmbedRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorBody("validation_error", "参数错误", flattenZodError(parsed.error)), 400);
    }

    const { hash, chunks } = parsed.data;
    const db = getDb(c);
    const cfg = await loadEffectiveConfig(c.env, db);
    const model = parsed.data.model ?? (cfg.embedModel || "@cf/baai/bge-m3");

    // Check if AI binding exists
    if (c.env.AI === undefined) {
      return c.json(errorBody("ai_not_configured", "Workers AI 未绑定"), 503);
    }

    let vectors: number[][];
    try {
      const results: number[][] = [];
      for (const chunk of chunks) {
        const raw = (await c.env.AI.run(model as never, { text: chunk })) as unknown;
        // Workers AI shape variants: {data: number[]} or {data: [[...]]} or {shape, data}
        let embedding: number[] | undefined;
        if (raw !== null && typeof raw === "object" && "data" in raw) {
          const data = (raw as { data: unknown }).data;
          if (Array.isArray(data) && data.length > 0) {
            const first = data[0];
            if (Array.isArray(first)) {
              embedding = first as number[];
            } else if (typeof first === "number") {
              embedding = data as number[];
            } else if (first !== null && typeof first === "object" && "embedding" in first) {
              embedding = (first as { embedding: number[] }).embedding;
            }
          }
        } else if (Array.isArray(raw)) {
          // direct array
          const first = raw[0];
          if (Array.isArray(first)) embedding = first as number[];
          else embedding = raw as number[];
        }
        if (embedding === undefined) {
          return c.json(errorBody("embedding_failed", `无法解析嵌入结果 for chunk`), 502);
        }
        results.push(embedding);
      }
      vectors = results;
    } catch (error) {
      return c.json(errorBody("embedding_failed", `嵌入失败: ${String(error)}`), 502);
    }

    const docVector = meanPool(vectors);
    const dim = docVector.length;
    const now = new Date().toISOString();

    await db
      .prepare(
        "INSERT INTO ai_results (hash, embed_model, embed_dim, embed_at, embed_vec, embed_chunks) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(hash) DO UPDATE SET embed_model=excluded.embed_model, embed_dim=excluded.embed_dim, embed_at=excluded.embed_at, embed_vec=excluded.embed_vec, embed_chunks=excluded.embed_chunks",
      )
      .bind(hash, model, dim, now, JSON.stringify(docVector), chunks.length)
      .run();

    return c.json({ hash, model, dim, chunkCount: chunks.length });
  });

  app.post("/api/ai/similar", authMiddleware(["ai"]), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = SimilarRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorBody("validation_error", "参数错误", flattenZodError(parsed.error)), 400);
    }

    const { hash, limit } = parsed.data;

    const db = getDb(c);
    const queryRow = await db
      .prepare("SELECT embed_vec FROM ai_results WHERE hash = ?")
      .bind(hash)
      .first<{ embed_vec: string | null }>();
    if (queryRow === null || queryRow === undefined || queryRow.embed_vec === null) {
      return c.json(errorBody("embedding_missing", "查询文章无嵌入向量"), 404);
    }

    let queryVector: number[];
    try {
      queryVector = JSON.parse(queryRow.embed_vec) as number[];
    } catch {
      return c.json(errorBody("embedding_missing", "查询向量解析失败"), 404);
    }

    const allPosts = await db.prepare("SELECT path, slug, title, hash FROM posts").all<{
      path: string;
      slug: string;
      title: string;
      hash: string;
    }>();
    const allVectors = await db
      .prepare("SELECT hash, embed_vec FROM ai_results WHERE embed_vec IS NOT NULL")
      .all<{
        hash: string;
        embed_vec: string | null;
      }>();

    const vecMap = new Map<string, number[]>();
    for (const row of allVectors.results ?? []) {
      if (row.embed_vec === null) continue;
      try {
        const vector = JSON.parse(row.embed_vec) as number[];
        vecMap.set(row.hash, vector);
      } catch {
        // ignore
      }
    }

    const candidates: { path: string; slug: string; title: string; score: number }[] = [];
    for (const post of allPosts.results ?? []) {
      if (post.hash === hash) continue;
      const vector = vecMap.get(post.hash);
      if (vector === undefined) continue;
      const score = cosine(queryVector, vector);
      candidates.push({ path: post.path, slug: post.slug, title: post.title, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    const items = candidates.slice(0, limit);

    return c.json({ query: hash, items });
  });

  app.post("/api/ai/status", authMiddleware(["ai"]), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = AiStatusRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorBody("validation_error", "参数错误", flattenZodError(parsed.error)), 400);
    }

    const db = getDb(c);
    const entries = [];
    for (const hash of parsed.data.hashes) {
      const row = await db
        .prepare(
          "SELECT summary, summary_model, summary_at, embed_model, embed_at, embed_vec FROM ai_results WHERE hash = ?",
        )
        .bind(hash)
        .first<{
          summary: string | null;
          summary_model: string | null;
          summary_at: string | null;
          embed_model: string | null;
          embed_at: string | null;
          embed_vec: string | null;
        }>();
      entries.push({
        hash,
        summary: {
          present:
            row !== null && row !== undefined && row.summary !== null && row.summary.length > 0,
          model: row?.summary_model ?? null,
          at: row?.summary_at ?? null,
        },
        embed: {
          present:
            row !== null && row !== undefined && row.embed_vec !== null && row.embed_vec.length > 0,
          model: row?.embed_model ?? null,
          at: row?.embed_at ?? null,
        },
      });
    }

    return c.json({ entries });
  });
}
