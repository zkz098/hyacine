// oxlint-disable typescript/no-unsafe-type-assertion
import { describe, expect, it, vi } from "vitest";
import { createTestEnv, getFakeD1 } from "../test-helpers";
import {
  classifyAiError,
  enqueueAiNeeds,
  extractWorkersAiText,
  nextQuotaRetryAt,
  processAiQueue,
  type AiNeed,
} from "./aiQueue";
import type { Env } from "../types";

function seededEnv(aiRun: (model: unknown, input: unknown) => Promise<unknown>): Env {
  const env = createTestEnv({
    AI: {
      run: async (model: unknown, input: unknown) => aiRun(model, input),
    } as unknown as Env["AI"],
  });
  const db = getFakeD1(env);
  db.appConfig.set("aiSummary.provider", "workers-ai");
  db.posts.set("a.md", {
    path: "a.md",
    slug: "a",
    title: "A",
    draft: 0,
    categories: "[]",
    hash: "a".repeat(16),
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    last_modified: "2026-08-01T00:00:00.000Z",
    content: "---\ntitle: A\n---\n\nHello world body.\n\nSecond paragraph.",
  });
  return env;
}

function queueNeed(over: Partial<AiNeed> = {}): AiNeed {
  return { hash: "a".repeat(16), path: "a.md", reason: "both", ...over };
}

describe("classifyAiError", () => {
  it("3036 → quota；3040 → capacity；5035/3023 → fatal；其他 → retryable", () => {
    expect(classifyAiError({ code: 3036 })).toBe("quota");
    expect(classifyAiError({ code: 3040 })).toBe("capacity");
    expect(classifyAiError({ code: 5035 })).toBe("fatal");
    expect(classifyAiError({ code: 3023 })).toBe("fatal");
    expect(classifyAiError({ code: 500 })).toBe("retryable");
    expect(classifyAiError(new Error("network down"))).toBe("retryable");
    expect(classifyAiError(new Error("daily free allocation of 10,000 neurons"))).toBe("quota");
  });
});

describe("nextQuotaRetryAt", () => {
  it("返回次日 00:40 UTC", () => {
    const d = nextQuotaRetryAt(new Date("2026-08-25T12:00:00.000Z"));
    expect(d).toBe("2026-08-26T00:40:00.000Z");
  });
});

describe("enqueueAiNeeds", () => {
  it("reason 合并为 both（已有 summary 再入 embed → both）", async () => {
    const env = createTestEnv();
    const db = getFakeD1(env);
    const needs = [queueNeed({ reason: "summary" }), queueNeed({ reason: "embed" })];
    await enqueueAiNeeds(env, needs);
    const row = db.aiQueue.get("a".repeat(16));
    expect(row?.kind).toBe("both");
    expect(row?.status).toBe("pending");
  });
});

describe("extractWorkersAiText", () => {
  it("文本生成模型 {response} → 提取", () => {
    expect(extractWorkersAiText({ response: "  一句话 摘要  " })).toBe("一句话 摘要");
  });
  it("Responses API {output_text} / {outputText} → 提取", () => {
    expect(extractWorkersAiText({ output_text: "a\nb" })).toBe("a b");
    expect(extractWorkersAiText({ outputText: "c" })).toBe("c");
  });
  it("OpenAI 兼容 {choices[].message.content} → 提取", () => {
    expect(
      extractWorkersAiText({ choices: [{ message: { content: "摘要内容" } }] }),
    ).toBe("摘要内容");
  });
  it("多模态部分数组（string 或 [{text}]）→ 拼接提取", () => {
    expect(extractWorkersAiText({ response: ["第一段", { text: "第二段" }] })).toBe(
      "第一段 第二段",
    );
    expect(
      extractWorkersAiText({ choices: [{ message: { content: [{ text: "A" }, "B"] } }] }),
    ).toBe("A B");
  });
  it("error / errors payload → 抛出带详情的错误（而非空摘要）", () => {
    expect(() => extractWorkersAiText({ error: { message: "model not found" } })).toThrow(
      /Workers AI 调用失败: model not found/,
    );
    expect(() => extractWorkersAiText({ errors: [{ message: "oops" }] })).toThrow(
      /Workers AI 调用失败: oops/,
    );
  });
  it("REST /ai/run 信封 {result:{...}} → 解包提取（response/choices）", () => {
    expect(extractWorkersAiText({ success: true, errors: [], result: { response: "信封摘要" } })).toBe(
      "信封摘要",
    );
    expect(
      extractWorkersAiText({
        success: true,
        errors: [],
        result: { choices: [{ message: { content: "信封choices" } }] },
      }),
    ).toBe("信封choices");
  });
  it("Workers AI 完整元数据信封（含 id, choices, usage, kv_transfer_params 等）→ 正常提取", () => {
    const payload = {
      id: "cmpl-01953284-07d0-7a0e-9134-d02fa74efc24",
      object: "chat.completion",
      created: 1740530000,
      model: "@cf/meta/llama-3.2-3b-instruct",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "这是一篇记录美好一天的随笔文章。",
          },
          finish_reason: "stop",
        },
      ],
      service_tier: "default",
      system_fingerprint: "fp_workers_ai",
      usage: { prompt_tokens: 120, completion_tokens: 25, total_tokens: 145 },
      prompt_logprobs: null,
      prompt_token_ids: [1, 2, 3],
      kv_transfer_params: {},
    };
    expect(extractWorkersAiText(payload)).toBe("这是一篇记录美好一天的随笔文章。");
  });
  it("纯文本补全模型 {choices: [{text}]} → 提取", () => {
    expect(extractWorkersAiText({ choices: [{ text: "补全摘要内容" }] })).toBe("补全摘要内容");
  });
  it("推理模型（DeepSeek-R1 / Qwen 等）无 content 仅 reasoning_content → 回退提取", () => {
    expect(
      extractWorkersAiText({
        choices: [{ message: { role: "assistant", content: null, reasoning_content: "思考得出的摘要内容" } }],
      }),
    ).toBe("思考得出的摘要内容");
  });
  it("Gemini 格式 {candidates: [{content: {parts: [{text}]}}]} → 提取", () => {
    expect(
      extractWorkersAiText({
        candidates: [{ content: { parts: [{ text: "Gemini 摘要" }] } }],
      }),
    ).toBe("Gemini 摘要");
  });
  it("无任何已知字段 → 返回空串（由调用方报空摘要）", () => {
    expect(extractWorkersAiText({ foo: "bar" })).toBe("");
    expect(extractWorkersAiText({ success: true, result: null })).toBe("");
    expect(extractWorkersAiText(null)).toBe("");
  });
});

describe("processAiQueue", () => {
  it("summary(workers-ai) + embed(both) 成功 → ai_results 落库、队列移除", async () => {
    const aiRun = vi
      .fn()
      // eslint-disable-next-line @typescript-eslint/require-await
      .mockImplementation(async (model: unknown) => {
        if (String(model).includes("bge")) return { data: [[0.1, 0.2]] };
        return { response: "这是一句简洁的摘要。" };
      });
    const env = seededEnv(aiRun);
    const db = getFakeD1(env);
    await enqueueAiNeeds(env, [queueNeed()]);
    const results = await processAiQueue(env, 10);
    expect(results[0]?.outcome).toBe("done");
    expect(db.aiQueue.size).toBe(0);
    const row = db.aiResults.get("a".repeat(16));
    expect(row?.summary).toContain("摘要");
    expect(row?.embed_vec).toBeTruthy();
  });

  it("3036(额度耗尽) → waiting + 次日 00:40 UTC，不提高 attempts 上限问题", async () => {
    const aiRun = vi.fn(async () => {
      throw Object.assign(new Error("limit exceeded"), { code: 3036 });
    });
    const env = seededEnv(aiRun);
    const db = getFakeD1(env);
    await enqueueAiNeeds(env, [queueNeed({ reason: "embed" })]);
    const results = await processAiQueue(env, 10);
    expect(results[0]?.outcome).toBe("waiting");
    const row = db.aiQueue.get("a".repeat(16));
    expect(row?.status).toBe("waiting");
    expect(row?.next_run_at).toBe(nextQuotaRetryAt());
  });

  it("3040(瞬时无容量) → pending + 5 分钟后重试", async () => {
    const aiRun = vi.fn(async () => {
      throw Object.assign(new Error("no capacity"), { code: 3040 });
    });
    const env = seededEnv(aiRun);
    const db = getFakeD1(env);
    const now = new Date("2026-08-25T12:00:00.000Z");
    await enqueueAiNeeds(env, [queueNeed({ reason: "embed" })], now);
    const results = await processAiQueue(env, 10, now);
    expect(results[0]?.outcome).toBe("retry");
    const row = db.aiQueue.get("a".repeat(16));
    expect(row?.status).toBe("pending");
    expect(row?.next_run_at).toBe("2026-08-25T12:05:00.000Z");
  });

  it("generic 错误超过 5 次 → failed", async () => {
    const aiRun = vi.fn(async () => {
      throw new Error("boom");
    });
    const env = seededEnv(aiRun);
    const db = getFakeD1(env);
    await enqueueAiNeeds(env, [queueNeed({ reason: "embed" })]);
    const dbRow = db.aiQueue.get("a".repeat(16));
    if (dbRow !== undefined) dbRow.attempts = 5;
    const results = await processAiQueue(env, 10);
    expect(results[0]?.outcome).toBe("failed");
    expect(db.aiQueue.get("a".repeat(16))?.status).toBe("failed");
  });

  it("无正文（posts.content 空）→ no_content 且不重试", async () => {
    const env = createTestEnv();
    const db = getFakeD1(env);
    await enqueueAiNeeds(env, [queueNeed()]);
    const results = await processAiQueue(env, 10);
    expect(results[0]?.outcome).toBe("no_content");
    expect(db.aiQueue.get("a".repeat(16))?.status).toBe("failed");
  });
});
