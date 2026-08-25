// oxlint-disable typescript/no-unsafe-type-assertion
import { describe, expect, it, vi } from "vitest";
import { createTestEnv, getFakeD1 } from "../test-helpers";
import {
  classifyAiError,
  enqueueAiNeeds,
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
    await enqueueAiNeeds(env, [queueNeed({ reason: "embed" })]);
    const now = new Date("2026-08-25T12:00:00.000Z");
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
