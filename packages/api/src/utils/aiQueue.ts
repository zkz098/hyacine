// oxlint-disable typescript/no-unsafe-type-assertion, eslint/no-await-in-loop
import type { Env } from "../types";
import type { AiSummaryProvider } from "@hyacine/contract";
import { loadEffectiveConfig } from "./config";
import { meanPool, stripFrontmatter } from "./crypto";

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

export async function enqueueAiNeeds(
  env: Env,
  needs: AiNeed[],
  now: Date = new Date(),
): Promise<void> {
  const nowIso = now.toISOString();
  for (const n of needs) {
    await env.DB.prepare(
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
async function loadContentFor(env: Env, path: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT content FROM posts WHERE path = ?")
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
  const json = (await response.json()) as {
    choices?: { message?: { content?: string | { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (json.error !== undefined) throw new Error(json.error.message ?? "AI 返回错误");
  const choice = json.choices?.[0]?.message?.content;
  if (typeof choice === "string") return choice.trim().replace(/\s+/g, " ");
  if (Array.isArray(choice)) {
    const textPart = choice.find((item) => typeof item.text === "string");
    return (textPart?.text ?? "").trim().replace(/\s+/g, " ");
  }
  throw new Error("AI 返回空摘要");
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
  const text =
    typeof result === "object" && result !== null
      ? ((result as { response?: unknown }).response ??
        (result as { output_text?: unknown }).output_text ??
        (result as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message
          ?.content)
      : undefined;
  const summary = typeof text === "string" ? text.trim().replace(/\s+/g, " ") : "";
  if (summary.length === 0) throw new Error("Workers AI 返回空摘要");
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
): Promise<void> {
  await env.DB.prepare(
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
): Promise<void> {
  await env.DB.prepare(
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
): Promise<ProcessSummary[]> {
  const cfg = await loadEffectiveConfig(env);
  const rows = await env.DB.prepare(
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
): Promise<ProcessSummary> {
  const base: ProcessSummary = { hash: row.hash, kind: row.kind, outcome: "failed" };
  // 防重入：处理中置锁
  await env.DB.prepare("UPDATE ai_queue SET status='processing', updated_at=? WHERE hash = ?")
    .bind(now.toISOString(), row.hash)
    .run();

  const content = await loadContentFor(env, row.path);
  if (content === null || content.length === 0) {
    await env.DB.prepare(
      "UPDATE ai_queue SET status='failed', last_error=?, updated_at=? WHERE hash = ?",
    )
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
      await storeSummaryResult(env, row.hash, summary, summaryModel, now);
    }
    if (row.kind === "embed" || row.kind === "both") {
      const vector = await generateEmbed(env, embedModel, stripped);
      await storeEmbedResult(env, row.hash, embedModel, now, vector, chunkText(stripped).length);
    }
    await env.DB.prepare("DELETE FROM ai_queue WHERE hash = ?").bind(row.hash).run();
    return { ...base, outcome: "done" };
  } catch (error) {
    const kind = classifyAiError(error);
    const msg = error instanceof Error ? error.message : String(error);
    const attempts = row.attempts + 1;
    if (kind === "quota") {
      await env.DB.prepare(
        "UPDATE ai_queue SET status='waiting', attempts=?, last_error=?, next_run_at=?, updated_at=? WHERE hash = ?",
      )
        .bind(attempts, msg, nextQuotaRetryAt(now), now.toISOString(), row.hash)
        .run();
      return { ...base, outcome: "waiting", error: msg };
    }
    if (kind === "capacity") {
      const retryAt = new Date(now.getTime() + CAPACITY_RETRY_MINUTES * 60_000).toISOString();
      await env.DB.prepare(
        "UPDATE ai_queue SET status='pending', attempts=?, last_error=?, next_run_at=?, updated_at=? WHERE hash = ?",
      )
        .bind(attempts, msg, retryAt, now.toISOString(), row.hash)
        .run();
      return { ...base, outcome: "retry", error: msg };
    }
    if (attempts >= MAX_ATTEMPTS) {
      await env.DB.prepare(
        "UPDATE ai_queue SET status='failed', attempts=?, last_error=?, updated_at=? WHERE hash = ?",
      )
        .bind(attempts, msg, now.toISOString(), row.hash)
        .run();
      return { ...base, outcome: "failed", error: msg };
    }
    const retryAt = new Date(now.getTime() + GENERIC_RETRY_MINUTES * 60_000).toISOString();
    await env.DB.prepare(
      "UPDATE ai_queue SET status='pending', attempts=?, last_error=?, next_run_at=?, updated_at=? WHERE hash = ?",
    )
      .bind(attempts, msg, retryAt, now.toISOString(), row.hash)
      .run();
    return { ...base, outcome: "retry", error: msg };
  }
}
