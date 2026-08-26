// oxlint-disable typescript/no-unsafe-type-assertion, eslint/no-await-in-loop
import type { Env } from "../types";
import type { AiSummaryProvider } from "@hyacine/contract";
import { loadEffectiveConfig } from "./config";
import { meanPool, stripFrontmatter } from "./crypto";
import type { DatabaseClient } from "./db";

/**
 * AI 产物自动队列：
 * - sync 上行后按 autogen 开关入队（需正文已落 D1 posts.content，P0 地基）
 * - 消费：sync 请求 waitUntil 小额内联 + Cron Trigger 定期 drain
 * - 错误分流：3036(日额度耗尽)→waiting 次日 00:40 UTC；3040(瞬时无容量)→短退避；
 *   5035/3023(fatal)→failed；其余重试 attempts+1，超 5 次 failed
 */

export type AiKind = "summary" | "embed" | "both";

export interface AiNeed {
  hash: string;
  path: string;
  reason: AiKind;
}

export const SUMMARY_WORKERS_DEFAULT_MODEL = "@cf/meta/llama-3.2-3b-instruct";
export const EMBED_DEFAULT_MODEL = "@cf/baai/bge-m3";
const MAX_ATTEMPTS = 5;
const CAPACITY_RETRY_MINUTES = 5;
const GENERIC_RETRY_MINUTES = 15;

function resolveDb(env: Env, db?: DatabaseClient): DatabaseClient {
  if (db !== undefined && db !== null) return db;
  if (env.DB && typeof env.DB.withSession === "function") {
    return env.DB.withSession("first-primary");
  }
  return env.DB;
}

export async function enqueueAiNeeds(
  env: Env,
  needs: AiNeed[],
  now: Date = new Date(),
  db?: DatabaseClient,
): Promise<void> {
  const client = resolveDb(env, db);
  const nowIso = now.toISOString();
  for (const n of needs) {
    await client
      .prepare(
        `INSERT INTO ai_queue (hash, path, kind, status, attempts, next_run_at, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', 0, ?, ?, ?)
       ON CONFLICT(hash) DO UPDATE SET
         path=excluded.path,
         kind=CASE
           WHEN ai_queue.kind='both' OR excluded.kind='both' THEN 'both'
           WHEN ai_queue.kind != excluded.kind THEN 'both'
           ELSE ai_queue.kind
         END,
         status='pending',
         next_run_at=excluded.next_run_at,
         updated_at=excluded.updated_at`,
      )
      .bind(n.hash, n.path, n.reason, nowIso, nowIso, nowIso)
      .run();
  }
}

/** 次日 00:40 UTC（额度 00:00 UTC 重置后留 40 分钟余量） */
export function nextQuotaRetryAt(now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 40, 0, 0);
  return d.toISOString();
}

/** Workers AI 错误分类（官方 errors 页：3036 额度耗尽 / 3040 无容量；403 5035/3023 fatal） */
export function classifyAiError(err: unknown): "quota" | "capacity" | "fatal" | "retryable" {
  const code = extractErrorCode(err);
  if (code === 3036) return "quota";
  if (code === 3040) return "capacity";
  if (code === 5035 || code === 3023) return "fatal";
  if (code === undefined) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("daily free allocation") || msg.includes("neuron")) return "quota";
    if (msg.includes("capacity") || msg.includes("No more data centers")) return "capacity";
    if (msg.includes("Workers Paid plan") || msg.includes("Service unavailable")) return "fatal";
  }
  return "retryable";
}

function extractErrorCode(err: unknown): number | undefined {
  if (err !== null && typeof err === "object") {
    const anyErr = err as { code?: unknown; errors?: unknown[]; status?: unknown };
    if (typeof anyErr.code === "number") return anyErr.code;
    if (Array.isArray(anyErr.errors) && anyErr.errors.length > 0) {
      const first = anyErr.errors[0] as { code?: unknown };
      if (typeof first?.code === "number") return first.code;
    }
    if (typeof anyErr.status === "number") return anyErr.status;
  }
  return undefined;
}

/** 取文章正文（自 D1）；无正文返回 null */
async function loadContentFor(env: Env, path: string, db?: DatabaseClient): Promise<string | null> {
  const client = resolveDb(env, db);
  const row = await client
    .prepare("SELECT content FROM posts WHERE path = ?")
    .bind(path)
    .first<{ content: string | null }>();
  return row?.content ?? null;
}

/** 段落切块（与 CLI chunkText 同构，800 字/块，上限 256 块） */
export function chunkText(text: string, maxChars = 800): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length === 0) continue;
    if (current.length + trimmed.length + 2 <= maxChars) {
      current = current.length === 0 ? trimmed : `${current}\n\n${trimmed}`;
    } else {
      if (current.length > 0) {
        chunks.push(current);
        current = "";
      }
      if (trimmed.length > maxChars) {
        const sentences = trimmed.split(/(?<=[.!?。！？])\s+/);
        let buf = "";
        for (const s of sentences) {
          const parts =
            s.length > maxChars ? (s.match(new RegExp(`.{1,${maxChars}}`, "g")) ?? [s]) : [s];
          for (const part of parts) {
            if (buf.length + part.length + 1 <= maxChars) {
              buf = buf.length === 0 ? part : `${buf} ${part}`;
            } else {
              if (buf.length > 0) chunks.push(buf);
              buf = part;
            }
          }
        }
        if (buf.length > 0) chunks.push(buf);
      } else {
        current = trimmed;
      }
    }
    if (chunks.length >= 256) break;
  }
  if (current.length > 0) chunks.push(current);
  if (chunks.length === 0 && text.trim().length > 0) chunks.push(text.trim().slice(0, maxChars));
  return chunks.slice(0, 256);
}

// ---- 摘要生成（provider 分流） ---------------------------------------------

/**
 * 递归从任何 AI 响应结构中提取纯文本。
 * 覆盖：
 * - OpenAI / Workers AI Chat Completions `{ choices: [{ message: { content } }] }`、`{ choices: [{ text }] }`、`{ choices: [{ delta: { content } }] }`
 * - 纯文本模型 `{ response }`、`{ text }`、`{ content }`、`{ summary }`
 * - Responses API `{ output_text }`、`{ outputText }`
 * - Gemini 格式 `{ candidates: [{ content: { parts: [{ text }] } }] }`
 * - 推理模型（DeepSeek-R1 / Qwen 等）`{ reasoning_content }` / `{ reasoning }`
 * - 多模态分段数组 `[{ type: "text", text: "..." }]`
 * - REST API 包装 `{ result: { ... } }`
 */
export function collectTextFromAny(v: unknown, depth = 0): string[] {
  if (depth > 6 || v === null || v === undefined) return [];
  if (typeof v === "string") {
    const trimmed = v.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }
  if (typeof v === "number" || typeof v === "boolean") {
    return [];
  }
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const item of v) {
      out.push(...collectTextFromAny(item, depth + 1));
    }
    return out;
  }
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const out: string[] = [];

    // 优先提取最明确的内容字段
    if ("content" in obj && obj.content !== null && obj.content !== undefined) {
      out.push(...collectTextFromAny(obj.content, depth + 1));
    }
    if ("text" in obj && obj.text !== null && obj.text !== undefined) {
      out.push(...collectTextFromAny(obj.text, depth + 1));
    }
    if ("response" in obj && obj.response !== null && obj.response !== undefined) {
      out.push(...collectTextFromAny(obj.response, depth + 1));
    }
    if ("output_text" in obj && obj.output_text !== null && obj.output_text !== undefined) {
      out.push(...collectTextFromAny(obj.output_text, depth + 1));
    }
    if ("outputText" in obj && obj.outputText !== null && obj.outputText !== undefined) {
      out.push(...collectTextFromAny(obj.outputText, depth + 1));
    }
    if ("summary" in obj && obj.summary !== null && obj.summary !== undefined) {
      out.push(...collectTextFromAny(obj.summary, depth + 1));
    }
    if ("message" in obj && obj.message !== null && obj.message !== undefined) {
      out.push(...collectTextFromAny(obj.message, depth + 1));
    }
    if ("delta" in obj && obj.delta !== null && obj.delta !== undefined) {
      out.push(...collectTextFromAny(obj.delta, depth + 1));
    }
    if ("parts" in obj && obj.parts !== null && obj.parts !== undefined) {
      out.push(...collectTextFromAny(obj.parts, depth + 1));
    }
    if ("value" in obj && obj.value !== null && obj.value !== undefined) {
      out.push(...collectTextFromAny(obj.value, depth + 1));
    }

    // 处理 choices / candidates / result 容器
    if ("choices" in obj && obj.choices !== null && obj.choices !== undefined) {
      out.push(...collectTextFromAny(obj.choices, depth + 1));
    }
    if ("candidates" in obj && obj.candidates !== null && obj.candidates !== undefined) {
      out.push(...collectTextFromAny(obj.candidates, depth + 1));
    }
    if ("result" in obj && obj.result !== null && obj.result !== undefined) {
      out.push(...collectTextFromAny(obj.result, depth + 1));
    }

    // 如果未提取到正文，回退尝试 reasoning_content/reasoning（如推理模型）
    if (out.length === 0) {
      if (
        "reasoning_content" in obj &&
        obj.reasoning_content !== null &&
        obj.reasoning_content !== undefined
      ) {
        out.push(...collectTextFromAny(obj.reasoning_content, depth + 1));
      }
      if ("reasoning" in obj && obj.reasoning !== null && obj.reasoning !== undefined) {
        out.push(...collectTextFromAny(obj.reasoning, depth + 1));
      }
    }

    return out;
  }
  return [];
}

/**
 * 从 Workers AI / AI Gateway 绑定或 BYOK 返回里提取纯文本。
 * 兼容 OpenAI / Workers AI Chat Completions、文本生成模型 `{ response }`、Responses API `{ output_text }`、
 * 以及各种结构体（choices, candidates, text, content, parts, reasoning 等）。
 * 若返回 payload 本身是错误对象（{error}/{errors}）则抛出带详情的错误而非“空摘要”。
 */
export function extractWorkersAiText(result: unknown): string {
  if (result === null || typeof result !== "object") return "";
  const obj = result as Record<string, unknown>;

  // 错误 payload：绑定失败时常以 {error} / {errors:[{message}]} 返回而非抛错
  const errMsg =
    (obj.error &&
      (typeof obj.error === "string"
        ? obj.error
        : (obj.error as { message?: unknown })?.message)) ||
    (Array.isArray(obj.errors) &&
      obj.errors.length > 0 &&
      (obj.errors[0] as { message?: unknown })?.message);
  if (typeof errMsg === "string" && errMsg.length > 0) {
    throw new Error(`Workers AI 调用失败: ${errMsg}`);
  }

  const parts = collectTextFromAny(result);

  return parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join(" ")
    .replace(/\s+/g, " ");
}

export async function generateSummaryByok(
  endpoint: string,
  key: string,
  model: string,
  stripped: string,
): Promise<string> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
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
    throw new Error(`AI 调用失败: ${response.status} ${text.slice(0, 500)}`);
  }
  const json: unknown = await response.json();
  const summary = extractWorkersAiText(json);
  if (summary.length === 0) {
    throw new Error("AI 返回空摘要");
  }
  return summary;
}

export async function generateSummaryWorkersAi(
  env: Env,
  model: string,
  stripped: string,
): Promise<string> {
  if (env.AI === undefined) throw new Error("Workers AI 未绑定");
  const result = (await env.AI.run(model as never, {
    messages: [
      {
        role: "system",
        content: "你是博客摘要助手，请用中文为以下文章生成一句简洁摘要（不超过 200 字）。",
      },
      { role: "user", content: stripped.slice(0, 8000) },
    ],
    max_tokens: 200,
  })) as unknown;
  const summary = extractWorkersAiText(result);
  if (summary.length === 0) {
    const keys =
      result !== null && typeof result === "object"
        ? Object.keys(result).join(",")
        : String(result);
    throw new Error(`Workers AI 返回空摘要（未识别的返回结构: ${keys}）`);
  }
  return summary;
}

// ---- 嵌入生成（Workers AI） -------------------------------------------------

export async function generateEmbed(env: Env, model: string, stripped: string): Promise<number[]> {
  if (env.AI === undefined) throw new Error("Workers AI 未绑定");
  const chunks = chunkText(stripped);
  const vectors: number[][] = [];
  for (const chunk of chunks) {
    const raw = (await env.AI.run(model as never, { text: chunk })) as unknown;
    let embedding: number[] | undefined;
    if (raw !== null && typeof raw === "object" && "data" in raw) {
      const data = (raw as { data: unknown }).data;
      if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        if (Array.isArray(first)) embedding = first as number[];
        else if (typeof first === "number") embedding = data as number[];
        else if (first !== null && typeof first === "object" && "embedding" in first) {
          embedding = (first as { embedding: number[] }).embedding;
        }
      }
    } else if (Array.isArray(raw)) {
      const first = raw[0];
      embedding = Array.isArray(first) ? (first as number[]) : (raw as number[]);
    }
    if (embedding === undefined) throw new Error("无法解析嵌入结果");
    vectors.push(embedding);
  }
  return meanPool(vectors);
}

// ---- 结果落库（queue 与手动 /api/ai/generate 共用） ------------------------

export async function storeSummaryResult(
  env: Env,
  hash: string,
  summary: string,
  model: string,
  at: Date,
  db?: DatabaseClient,
): Promise<void> {
  const client = resolveDb(env, db);
  await client
    .prepare(
      "INSERT INTO ai_results (hash, summary, summary_model, summary_at) VALUES (?, ?, ?, ?) ON CONFLICT(hash) DO UPDATE SET summary=excluded.summary, summary_model=excluded.summary_model, summary_at=excluded.summary_at",
    )
    .bind(hash, summary, model, at.toISOString())
    .run();
}

export async function storeEmbedResult(
  env: Env,
  hash: string,
  model: string,
  at: Date,
  vector: number[],
  chunks: number,
  db?: DatabaseClient,
): Promise<void> {
  const client = resolveDb(env, db);
  await client
    .prepare(
      "INSERT INTO ai_results (hash, embed_model, embed_dim, embed_at, embed_vec, embed_chunks) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(hash) DO UPDATE SET embed_model=excluded.embed_model, embed_dim=excluded.embed_dim, embed_at=excluded.embed_at, embed_vec=excluded.embed_vec, embed_chunks=excluded.embed_chunks",
    )
    .bind(hash, model, vector.length, at.toISOString(), JSON.stringify(vector), chunks)
    .run();
}

// ---- 队列消费 -----------------------------------------------------------------

interface QueueRow {
  hash: string;
  path: string;
  kind: AiKind;
  status: string;
  attempts: number;
  next_run_at: string;
  last_error: string | null;
}

interface ProcessSummary {
  hash: string;
  kind: AiKind;
  outcome: "done" | "waiting" | "retry" | "failed" | "no_content";
  error?: string;
}

/** 消费就绪任务（pending/waiting 且 next_run_at <= now），返回每项结果 */
export async function processAiQueue(
  env: Env,
  budget = 10,
  now: Date = new Date(),
  db?: DatabaseClient,
): Promise<ProcessSummary[]> {
  const client = resolveDb(env, db);
  const cfg = await loadEffectiveConfig(env, client);
  const rows = await client
    .prepare(
      "SELECT hash, path, kind, status, attempts, next_run_at, last_error FROM ai_queue WHERE status IN ('pending','waiting') AND next_run_at <= ? ORDER BY next_run_at LIMIT ?",
    )
    .bind(now.toISOString(), budget)
    .all<QueueRow>();

  const summaryModel =
    cfg.aiSummary.model.length > 0 ? cfg.aiSummary.model : SUMMARY_WORKERS_DEFAULT_MODEL;
  const embedModel = cfg.embedModel.length > 0 ? cfg.embedModel : EMBED_DEFAULT_MODEL;

  const results: ProcessSummary[] = [];
  for (const row of rows.results ?? []) {
    results.push(
      await processOne(
        env,
        row,
        cfg.aiSummary.provider,
        cfg.aiSummary.endpoint,
        cfg.aiSummary.key,
        summaryModel,
        embedModel,
        now,
        client,
      ),
    );
  }
  return results;
}

async function processOne(
  env: Env,
  row: QueueRow,
  provider: AiSummaryProvider,
  byokEndpoint: string,
  byokKey: string,
  summaryModel: string,
  embedModel: string,
  now: Date,
  db: DatabaseClient,
): Promise<ProcessSummary> {
  const base: ProcessSummary = { hash: row.hash, kind: row.kind, outcome: "failed" };
  // 防重入：处理中置锁
  await db
    .prepare("UPDATE ai_queue SET status='processing', updated_at=? WHERE hash = ?")
    .bind(now.toISOString(), row.hash)
    .run();

  const content = await loadContentFor(env, row.path, db);
  if (content === null || content.length === 0) {
    await db
      .prepare("UPDATE ai_queue SET status='failed', last_error=?, updated_at=? WHERE hash = ?")
      .bind("无正文(posts.content 为空)", now.toISOString(), row.hash)
      .run();
    return { ...base, outcome: "no_content", error: "post content missing" };
  }
  const stripped = stripFrontmatter(content);

  try {
    if (row.kind === "summary" || row.kind === "both") {
      const summary =
        provider === "workers-ai"
          ? await generateSummaryWorkersAi(env, summaryModel, stripped)
          : await generateSummaryByok(byokEndpoint, byokKey, summaryModel, stripped);
      await storeSummaryResult(env, row.hash, summary, summaryModel, now, db);
    }
    if (row.kind === "embed" || row.kind === "both") {
      const vector = await generateEmbed(env, embedModel, stripped);
      await storeEmbedResult(
        env,
        row.hash,
        embedModel,
        now,
        vector,
        chunkText(stripped).length,
        db,
      );
    }
    await db.prepare("DELETE FROM ai_queue WHERE hash = ?").bind(row.hash).run();
    return { ...base, outcome: "done" };
  } catch (error) {
    const kind = classifyAiError(error);
    const msg = error instanceof Error ? error.message : String(error);
    const attempts = row.attempts + 1;
    if (kind === "quota") {
      await db
        .prepare(
          "UPDATE ai_queue SET status='waiting', attempts=?, last_error=?, next_run_at=?, updated_at=? WHERE hash = ?",
        )
        .bind(attempts, msg, nextQuotaRetryAt(now), now.toISOString(), row.hash)
        .run();
      return { ...base, outcome: "waiting", error: msg };
    }
    if (kind === "capacity") {
      const retryAt = new Date(now.getTime() + CAPACITY_RETRY_MINUTES * 60_000).toISOString();
      await db
        .prepare(
          "UPDATE ai_queue SET status='pending', attempts=?, last_error=?, next_run_at=?, updated_at=? WHERE hash = ?",
        )
        .bind(attempts, msg, retryAt, now.toISOString(), row.hash)
        .run();
      return { ...base, outcome: "retry", error: msg };
    }
    if (attempts >= MAX_ATTEMPTS) {
      await db
        .prepare(
          "UPDATE ai_queue SET status='failed', attempts=?, last_error=?, updated_at=? WHERE hash = ?",
        )
        .bind(attempts, msg, now.toISOString(), row.hash)
        .run();
      return { ...base, outcome: "failed", error: msg };
    }
    const retryAt = new Date(now.getTime() + GENERIC_RETRY_MINUTES * 60_000).toISOString();
    await db
      .prepare(
        "UPDATE ai_queue SET status='pending', attempts=?, last_error=?, next_run_at=?, updated_at=? WHERE hash = ?",
      )
      .bind(attempts, msg, retryAt, now.toISOString(), row.hash)
      .run();
    return { ...base, outcome: "retry", error: msg };
  }
}
