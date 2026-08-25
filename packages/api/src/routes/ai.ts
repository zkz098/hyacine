// oxlint-disable typescript/no-unsafe-type-assertion, typescript/no-unnecessary-type-assertion, eslint/no-await-in-loop
import { Hono } from "hono";
import {
  AiStatusRequestSchema,
  EmbedRequestSchema,
  SimilarRequestSchema,
  SummaryRequestSchema,
} from "@hyacine/contract";
import { cosine, meanPool, stripFrontmatter } from "../utils/crypto";
import { errorBody } from "../utils/errors";
import { defer } from "../utils/defer";
import { authMiddleware } from "../middleware/auth";
import type { Env, Variables } from "../types";

export function aiRoutes(app: Hono<{ Bindings: Env; Variables: Variables }>): void {
  app.post("/api/ai/summary", authMiddleware(["ai"]), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = SummaryRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorBody("validation_error", "参数错误", parsed.error.flatten()), 400);
    }

    const { hash, content, model } = parsed.data;

    const endpoint = c.env.AI_SUMMARY_ENDPOINT;
    const key = c.env.AI_SUMMARY_KEY;
    const configuredModel = c.env.AI_SUMMARY_MODEL;
    const usedModel = model ?? configuredModel ?? "unknown";

    // KV cache check: try D1 first
    const existing = await c.env.DB.prepare(
      "SELECT summary, summary_model, summary_at FROM ai_results WHERE hash = ?",
    )
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

    if (endpoint === undefined || endpoint.length === 0 || key === undefined || key.length === 0) {
      return c.json(errorBody("ai_not_configured", "未配置 AI 摘要端点"), 503);
    }

    const stripped = stripFrontmatter(content);

    // Call OpenAI compatible
    let summaryText: string;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: usedModel,
          messages: [
            {
              role: "system",
              content: "你是博客摘要助手，请用中文为以下文章生成一句简洁摘要（不超过 200 字）。",
            },
            { role: "user", content: stripped.slice(0, 8000) },
          ],
          max_tokens: 200,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        return c.json(
          errorBody("ai_failed", `AI 调用失败: ${response.status} ${text.slice(0, 500)}`),
          502,
        );
      }

      const json = (await response.json()) as {
        choices?: { message?: { content?: string | { text?: string }[] } }[];
        error?: { message?: string };
      };
      if (json.error !== undefined) {
        return c.json(errorBody("ai_failed", json.error.message ?? "AI 返回错误"), 502);
      }
      const choice = json.choices?.[0]?.message?.content;
      if (typeof choice === "string") {
        summaryText = choice.trim().replace(/\s+/g, " ");
      } else if (Array.isArray(choice)) {
        const textPart = choice.find((item) => typeof item.text === "string");
        summaryText = (textPart?.text ?? "").trim().replace(/\s+/g, " ");
      } else {
        summaryText = "";
      }
      if (summaryText.length === 0) {
        return c.json(errorBody("ai_failed", "AI 返回空摘要"), 502);
      }
    } catch (error) {
      return c.json(errorBody("ai_failed", `AI 调用异常: ${String(error)}`), 502);
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      "INSERT INTO ai_results (hash, summary, summary_model, summary_at) VALUES (?, ?, ?, ?) ON CONFLICT(hash) DO UPDATE SET summary=excluded.summary, summary_model=excluded.summary_model, summary_at=excluded.summary_at",
    )
      .bind(hash, summaryText, usedModel, now)
      .run();

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
      return c.json(errorBody("validation_error", "参数错误", parsed.error.flatten()), 400);
    }

    const { hash, chunks } = parsed.data;
    const model = parsed.data.model ?? c.env.EMBED_MODEL ?? "@cf/baai/bge-m3";

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

    await c.env.DB.prepare(
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
      return c.json(errorBody("validation_error", "参数错误", parsed.error.flatten()), 400);
    }

    const { hash, limit } = parsed.data;

    const queryRow = await c.env.DB.prepare("SELECT embed_vec FROM ai_results WHERE hash = ?")
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

    const allPosts = await c.env.DB.prepare("SELECT path, slug, title, hash FROM posts").all<{
      path: string;
      slug: string;
      title: string;
      hash: string;
    }>();
    const allVectors = await c.env.DB.prepare(
      "SELECT hash, embed_vec FROM ai_results WHERE embed_vec IS NOT NULL",
    ).all<{
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
      return c.json(errorBody("validation_error", "参数错误", parsed.error.flatten()), 400);
    }

    const entries = [];
    for (const hash of parsed.data.hashes) {
      const row = await c.env.DB.prepare(
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
