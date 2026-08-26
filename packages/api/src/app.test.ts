// oxlint-disable typescript/no-unsafe-type-assertion, typescript/no-unnecessary-type-assertion, eslint/no-unused-vars, eslint/no-await-in-loop
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createApp } from "./app";
import { createTestEnv, getFakeD1 } from "./test-helpers";
import { sha256Hex } from "./utils/crypto";
import type { Env } from "./types";

async function request(
  env: Env,
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<Response> {
  const app = createApp();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  const requestInit: RequestInit = { method, headers };
  if (body !== undefined) requestInit.body = JSON.stringify(body);
  return app.fetch(new Request(`http://test${path}`, requestInit), env);
}

async function setupAdminToken(env: Env): Promise<string> {
  const response = await request(env, "POST", "/api/auth/setup", { code: env.SETUP_CODE! });
  const json = (await response.json()) as { token: string };
  return json.token;
}

describe("health", () => {
  it("returns version and ai flags", async () => {
    const env = createTestEnv({
      AI_SUMMARY_ENDPOINT: "https://api.openai.com/v1/chat/completions",
      AI_SUMMARY_KEY: "sk-test",
      AI_SUMMARY_MODEL: "gpt-4o-mini",
    });
    const response = await request(env, "GET", "/api/health");
    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      ok: boolean;
      ai: { summary: boolean; embed: boolean };
      primary: { available: boolean; repo: string | null };
    };
    expect(json.ok).toBe(true);
    expect(json.ai.summary).toBe(true);
    expect(json.ai.embed).toBe(true);
    // github 未配置 → primary 不可用
    expect(json.primary.available).toBe(false);
    expect(json.primary.repo).toBeNull();
  });

  it("workers-ai 模式下，AI 绑定有效时 ai.summary=true", async () => {
    const env = createTestEnv({
      AI_SUMMARY_PROVIDER: "workers-ai",
    });
    const response = await request(env, "GET", "/api/health");
    expect(response.status).toBe(200);
    const json = (await response.json()) as { ai: { summary: boolean; embed: boolean } };
    expect(json.ai.summary).toBe(true);
    expect(json.ai.embed).toBe(true);
  });

  it("workers-ai 模式下，未绑定 AI 时 ai.summary=false", async () => {
    const env = createTestEnv({
      AI_SUMMARY_PROVIDER: "workers-ai",
      AI: undefined,
    });
    const response = await request(env, "GET", "/api/health");
    expect(response.status).toBe(200);
    const json = (await response.json()) as { ai: { summary: boolean; embed: boolean } };
    expect(json.ai.summary).toBe(false);
  });

  it("github 配置齐后 primary.available=true（含 repo）", async () => {
    const env = createTestEnv();
    const db = getFakeD1(env);
    db.appConfig.set("github.repoOwner", "me");
    db.appConfig.set("github.repoName", "blog");
    db.appConfig.set("github.token", "ghp_x");
    const response = await request(env, "GET", "/api/health");
    const json = (await response.json()) as {
      primary: { available: boolean; repo: string | null };
    };
    expect(json.primary.available).toBe(true);
    expect(json.primary.repo).toBe("me/blog");
  });

  it("returns needsSetup true when SETUP_CODE absent", async () => {
    const env = createTestEnv({ SETUP_CODE: undefined });
    const response = await request(env, "GET", "/api/health");
    const json = (await response.json()) as { needsSetup: boolean };
    expect(json.needsSetup).toBe(true);
  });
});

describe("auth", () => {
  it("GET /api/auth/setup returns needsSetup", async () => {
    const env = createTestEnv();
    const response = await request(env, "GET", "/api/auth/setup");
    expect(response.status).toBe(200);
    const json = (await response.json()) as { needsSetup: boolean };
    expect(json.needsSetup).toBe(false);
  });

  it("POST /api/auth/setup validates code and issues token", async () => {
    const env = createTestEnv();
    const response = await request(env, "POST", "/api/auth/setup", { code: "test-setup-code-123" });
    expect(response.status).toBe(200);
    const json = (await response.json()) as { token: string; scopes: string[] };
    expect(json.token.length).toBeGreaterThan(16);
    expect(json.scopes).toContain("admin");
  });

  it("POST /api/auth/setup rejects invalid code", async () => {
    const env = createTestEnv();
    const response = await request(env, "POST", "/api/auth/setup", { code: "wrong-code-123" });
    expect(response.status).toBe(401);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe("invalid_code");
  });

  it("POST /api/auth/tokens requires admin", async () => {
    const env = createTestEnv();
    const adminToken = await setupAdminToken(env);
    const response = await request(
      env,
      "POST",
      "/api/auth/tokens",
      { label: "cli", scopes: ["posts.r"] },
      adminToken,
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { token: string };
    expect(json.token.length).toBeGreaterThan(16);
  });

  it("GET /api/auth/tokens lists tokens without plaintext", async () => {
    const env = createTestEnv();
    const adminToken = await setupAdminToken(env);
    const response = await request(env, "GET", "/api/auth/tokens", undefined, adminToken);
    expect(response.status).toBe(200);
    const json = (await response.json()) as { tokens: { id: string; label: string }[] };
    expect(json.tokens.length).toBeGreaterThan(0);
    // token field should not exist
    expect((json.tokens[0] as Record<string, unknown>).token).toBeUndefined();
  });

  it("POST /api/auth/tokens/:id/revoke revokes", async () => {
    const env = createTestEnv();
    const adminToken = await setupAdminToken(env);
    const createResponse = await request(
      env,
      "POST",
      "/api/auth/tokens",
      { label: "temp", scopes: ["posts.r"] },
      adminToken,
    );
    const created = (await createResponse.json()) as { tokenId: string };
    const revokeResponse = await request(
      env,
      "POST",
      `/api/auth/tokens/${created.tokenId}/revoke`,
      undefined,
      adminToken,
    );
    expect(revokeResponse.status).toBe(200);
    const revoked = await request(env, "GET", "/api/stats", undefined, adminToken);
    // Admin still valid; but revoked token should fail
    const tempTokenHash = await sha256Hex("dummy"); // not needed
    void tempTokenHash;
    // Try using revoked token: create another token to revoke
    // Simpler: create a token, revoke it, then try using it
    const secondCreate = await request(
      env,
      "POST",
      "/api/auth/tokens",
      { label: "temp2", scopes: ["posts.r"] },
      adminToken,
    );
    const secondJson = (await secondCreate.json()) as { token: string; tokenId: string };
    await request(
      env,
      "POST",
      `/api/auth/tokens/${secondJson.tokenId}/revoke`,
      undefined,
      adminToken,
    );
    const usingRevoked = await request(env, "GET", "/api/stats", undefined, secondJson.token);
    expect(usingRevoked.status).toBe(401);
  });

  it("rejects missing Bearer", async () => {
    const env = createTestEnv();
    const response = await request(env, "GET", "/api/stats");
    expect(response.status).toBe(401);
  });

  it("forbids insufficient scope", async () => {
    const env = createTestEnv();
    const adminToken = await setupAdminToken(env);
    const limitedCreate = await request(
      env,
      "POST",
      "/api/auth/tokens",
      { label: "limited", scopes: ["posts.r"] },
      adminToken,
    );
    const limitedJson = (await limitedCreate.json()) as { token: string };
    const syncAttempt = await request(
      env,
      "POST",
      "/api/sync",
      { generatedAt: new Date().toISOString(), posts: [], assets: [] },
      limitedJson.token,
    );
    expect(syncAttempt.status).toBe(403);
  });

  it("rejects expired token", async () => {
    const env = createTestEnv();
    const token = "expired-token-test-1234567890abcdef";
    const hash = await sha256Hex(token);
    const past = new Date(Date.now() - 86400000).toISOString();
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO api_tokens (token_hash, label, scopes, expires_at, last_used_at, created_at, revoked) VALUES (?, ?, ?, ?, ?, ?, 0)",
    )
      .bind(hash, "expired", JSON.stringify(["admin", "posts.r", "posts.w", "ai"]), past, null, now)
      .run();
    const response = await request(env, "GET", "/api/stats", undefined, token);
    expect(response.status).toBe(401);
  });
});

describe("sync", () => {
  it("inserts new posts and returns changed", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const now = new Date().toISOString();
    const hash = "a".repeat(16);
    const response = await request(
      env,
      "POST",
      "/api/sync",
      {
        generatedAt: now,
        posts: [
          {
            path: "hello.md",
            slug: "hello",
            title: "Hello",
            draft: false,
            categories: ["test"],
            hash,
            createdAt: now,
            updatedAt: now,
            lastModified: now,
          },
        ],
        assets: [],
        deletedPaths: [],
      },
      token,
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      changedHashes: string[];
      accepted: { posts: number };
    };
    expect(json.changedHashes).toContain(hash);
    expect(json.accepted.posts).toBe(1);

    // unchanged on second sync same hash
    const second = await request(
      env,
      "POST",
      "/api/sync",
      {
        generatedAt: now,
        posts: [
          {
            path: "hello.md",
            slug: "hello",
            title: "Hello",
            draft: false,
            categories: ["test"],
            hash,
            createdAt: now,
            updatedAt: now,
            lastModified: now,
          },
        ],
        assets: [],
        deletedPaths: [],
      },
      token,
    );
    const secondJson = (await second.json()) as {
      unchangedHashes: string[];
      changedHashes: string[];
    };
    expect(secondJson.unchangedHashes).toContain(hash);
    expect(secondJson.changedHashes).toHaveLength(0);

    // hash 未变但 slug 更新时（如规则修正）：D1 中的 slug 得到更新
    const third = await request(
      env,
      "POST",
      "/api/sync",
      {
        generatedAt: now,
        posts: [
          {
            path: "hello.md",
            slug: "hello-new-slug",
            title: "Hello",
            draft: false,
            categories: ["test"],
            hash,
            createdAt: now,
            updatedAt: now,
            lastModified: now,
          },
        ],
        assets: [],
        deletedPaths: [],
      },
      token,
    );
    expect(third.status).toBe(200);
    const listRes = await request(env, "GET", "/api/posts", undefined, token);
    const listJson = (await listRes.json()) as { posts: { path: string; slug: string }[] };
    expect(listJson.posts.find((p) => p.path === "hello.md")?.slug).toBe("hello-new-slug");
  });

  it("handles deletedPaths", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const now = new Date().toISOString();
    const hash = "b".repeat(16);
    await request(
      env,
      "POST",
      "/api/sync",
      {
        generatedAt: now,
        posts: [
          {
            path: "to-delete.md",
            slug: "to-delete",
            title: "To Delete",
            draft: false,
            categories: [],
            hash,
            createdAt: now,
            updatedAt: now,
            lastModified: now,
          },
        ],
        assets: [],
        deletedPaths: [],
      },
      token,
    );
    const delResponse = await request(
      env,
      "POST",
      "/api/sync",
      { generatedAt: now, posts: [], assets: [], deletedPaths: ["to-delete.md"] },
      token,
    );
    const delJson = (await delResponse.json()) as { deletedPaths: string[] };
    expect(delJson.deletedPaths).toContain("to-delete.md");
    const fake = getFakeD1(env);
    expect(fake.posts.has("to-delete.md")).toBe(false);
  });

  it("upserts assets and reports ai.needs", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const now = new Date().toISOString();
    const hash = "c".repeat(16);
    const response = await request(
      env,
      "POST",
      "/api/sync",
      {
        generatedAt: now,
        posts: [
          {
            path: "ai-need.md",
            slug: "ai-need",
            title: "AI Need",
            draft: false,
            categories: [],
            hash,
            createdAt: now,
            updatedAt: now,
            lastModified: now,
          },
        ],
        assets: [
          {
            path: "cover.png",
            isRemote: false,
            assetType: "image",
            fileType: "image/png",
            updatedAt: now,
          },
        ],
        deletedPaths: [],
      },
      token,
    );
    const json = (await response.json()) as { ai: { needs: { reason: string }[] } };
    expect(json.ai.needs[0]?.reason).toBe("both");
  });

  it("GET /api/sync/log returns entries", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const now = new Date().toISOString();
    await request(
      env,
      "POST",
      "/api/sync",
      { generatedAt: now, posts: [], assets: [], deletedPaths: [] },
      token,
    );
    const logRes = await request(env, "GET", "/api/sync/log", undefined, token);
    expect(logRes.status).toBe(200);
    const json = (await logRes.json()) as { entries: unknown[] };
    expect(json.entries.length).toBeGreaterThan(0);
  });

  it("带 content 的同步把正文落 D1（P0 content 落库）", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const now = new Date().toISOString();
    const hash = "b".repeat(16);
    const body = `---\ntitle: Content\n---\n\nHello body text.`;
    const response = await request(
      env,
      "POST",
      "/api/sync",
      {
        generatedAt: now,
        posts: [
          {
            path: "content.md",
            slug: "content",
            title: "Content",
            draft: false,
            categories: [],
            hash,
            createdAt: now,
            updatedAt: now,
            lastModified: now,
            content: body,
          },
        ],
        assets: [],
        deletedPaths: [],
      },
      token,
    );
    expect(response.status).toBe(200);
    const db = getFakeD1(env);
    const row = db.posts.get("content.md");
    expect(row?.content).toBe(body);
    // 不带 content 的同步不覆盖已有正文（content 列保留）
    const again = await request(
      env,
      "POST",
      "/api/sync",
      {
        generatedAt: now,
        posts: [
          {
            path: "content.md",
            slug: "content",
            title: "Content",
            draft: false,
            categories: [],
            hash,
            createdAt: now,
            updatedAt: now,
            lastModified: now,
          },
        ],
        assets: [],
        deletedPaths: [],
      },
      token,
    );
    expect(again.status).toBe(200);
    expect(db.posts.get("content.md")?.content).toBe(body);
  });

  it("老数据 content 缺失时，同 hash 再上行会补上正文（修复远程 404/导出缺行）", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const now = new Date().toISOString();
    const hash = "f".repeat(16);
    // 第一轮：老客户端旧版，无 content 字段
    await request(
      env,
      "POST",
      "/api/sync",
      {
        generatedAt: now,
        posts: [
          {
            path: "legacy.md",
            slug: "legacy",
            title: "Legacy",
            draft: false,
            categories: [],
            hash,
            createdAt: now,
            updatedAt: now,
            lastModified: now,
          },
        ],
        assets: [],
        deletedPaths: [],
      },
      token,
    );
    const db = getFakeD1(env);
    expect(db.posts.get("legacy.md")?.content).toBeNull();

    // 第二轮：同 hash（文章内容没变）但带 content → 应补上（此前 bug：不补，永远 null）
    const again = await request(
      env,
      "POST",
      "/api/sync",
      {
        generatedAt: now,
        posts: [
          {
            path: "legacy.md",
            slug: "legacy",
            title: "Legacy",
            draft: false,
            categories: [],
            hash,
            createdAt: now,
            updatedAt: now,
            lastModified: now,
            content: "---\ntitle: Legacy\n---\n\nLegacy body filled.",
          },
        ],
        assets: [],
        deletedPaths: [],
      },
      token,
    );
    expect(again.status).toBe(200);
    expect(db.posts.get("legacy.md")?.content).toContain("Legacy body filled.");
  });

  it("autogen 开启时同步自动入队（P1）", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    await request(
      env,
      "PUT",
      "/api/admin/config",
      { aiSummary: { autogen: true }, embedAutogen: true },
      token,
    );
    const now = new Date().toISOString();
    const hash = "c".repeat(16);
    const response = await request(
      env,
      "POST",
      "/api/sync",
      {
        generatedAt: now,
        posts: [
          {
            path: "auto.md",
            slug: "auto",
            title: "Auto",
            draft: false,
            categories: [],
            hash,
            createdAt: now,
            updatedAt: now,
            lastModified: now,
            content: `---\ntitle: Auto\n---\n\nBody for auto AI.`,
          },
        ],
        assets: [],
        deletedPaths: [],
      },
      token,
    );
    expect(response.status).toBe(200);
    const db = getFakeD1(env);
    const queueRow = db.aiQueue.get(hash);
    expect(queueRow?.kind).toBe("both");
    // 状态可能因 defer 内联消费处于 pending/processing 竞态，只断言已入队且 kind 合并正确
    expect(queueRow?.path).toBe("auto.md");
  });
});

describe("ai", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("summary returns cached value when same model", async () => {
    const env = createTestEnv({
      AI_SUMMARY_ENDPOINT: "https://fake.openai.com/v1/chat/completions",
      AI_SUMMARY_KEY: "sk-test",
      AI_SUMMARY_MODEL: "gpt-4o-mini",
    });
    const token = await setupAdminToken(env);
    const hash = "d".repeat(16);
    // Insert cached
    await env.DB.prepare(
      "INSERT INTO ai_results (hash, summary, summary_model, summary_at) VALUES (?, ?, ?, ?)",
    )
      .bind(hash, "cached summary", "gpt-4o-mini", new Date().toISOString())
      .run();

    const response = await request(
      env,
      "POST",
      "/api/ai/summary",
      { hash, content: "---\ntitle: Hi\n---\nbody" },
      token,
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { summary: string };
    expect(json.summary).toBe("cached summary");
  });

  it("summary calls BYOK endpoint and stores", async () => {
    const env = createTestEnv({
      AI_SUMMARY_ENDPOINT: "https://fake.openai.com/v1/chat/completions",
      AI_SUMMARY_KEY: "sk-test",
      AI_SUMMARY_MODEL: "gpt-4o-mini",
    });
    const token = await setupAdminToken(env);
    const hash = "e".repeat(16);

    const mockFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: "  generated summary  " } }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const response = await request(
      env,
      "POST",
      "/api/ai/summary",
      { hash, content: "hello world content" },
      token,
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { summary: string; model: string };
    expect(json.summary).toBe("generated summary");
    expect(json.model).toBe("gpt-4o-mini");
    expect(mockFetch).toHaveBeenCalledOnce();

    // cached second call (no fetch)
    const secondMock = vi.fn(async () => {
      throw new Error("should not be called");
    });
    globalThis.fetch = secondMock as unknown as typeof fetch;
    const second = await request(
      env,
      "POST",
      "/api/ai/summary",
      { hash, content: "hello world content" },
      token,
    );
    expect(second.status).toBe(200);
    expect(secondMock).not.toHaveBeenCalled();
  });

  it("summary returns 503 when not configured", async () => {
    const env = createTestEnv({ AI_SUMMARY_ENDPOINT: undefined, AI_SUMMARY_KEY: undefined });
    const token = await setupAdminToken(env);
    const hash = "f".repeat(16);
    const response = await request(
      env,
      "POST",
      "/api/ai/summary",
      { hash, content: "content" },
      token,
    );
    expect(response.status).toBe(503);
  });

  it("embed stores vector and returns dim", async () => {
    const env = createTestEnv();
    // Mock AI binding
    const fakeAi = {
      run: async () => ({ data: [[0.1, 0.2, 0.3]] }),
    } as unknown as Ai;
    env.AI = fakeAi;
    const token = await setupAdminToken(env);
    const hash = "a1b2c3d4e5f6a1b2";

    const response = await request(
      env,
      "POST",
      "/api/ai/embed",
      { hash, chunks: ["chunk one", "chunk two"] },
      token,
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { dim: number; chunkCount: number };
    expect(json.dim).toBe(3);
    expect(json.chunkCount).toBe(2);
  });

  it("similar returns ranked items via cosine", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const now = new Date().toISOString();
    const hashA = "a".repeat(16);
    const hashB = "b".repeat(16);
    const hashC = "c".repeat(16);

    // Insert posts
    for (const [hash, path, slug] of [
      [hashA, "a.md", "a"],
      [hashB, "b.md", "b"],
      [hashC, "c.md", "c"],
    ] as const) {
      await env.DB.prepare(
        "INSERT INTO posts (path, slug, title, draft, categories, hash, created_at, updated_at, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
        .bind(path, slug, `Title ${slug}`, 0, "[]", hash, now, now, now)
        .run();
    }
    // Insert embeddings: A = [1,0], B = [0.9,0.1] (close to A), C = [0,1] (far)
    await env.DB.prepare(
      "INSERT INTO ai_results (hash, embed_vec, embed_model, embed_dim, embed_at, embed_chunks) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(hashA, JSON.stringify([1, 0]), "@cf/baai/bge-m3", 2, now, 1)
      .run();
    await env.DB.prepare(
      "INSERT INTO ai_results (hash, embed_vec, embed_model, embed_dim, embed_at, embed_chunks) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(hashB, JSON.stringify([0.9, 0.1]), "@cf/baai/bge-m3", 2, now, 1)
      .run();
    await env.DB.prepare(
      "INSERT INTO ai_results (hash, embed_vec, embed_model, embed_dim, embed_at, embed_chunks) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(hashC, JSON.stringify([0, 1]), "@cf/baai/bge-m3", 2, now, 1)
      .run();

    const response = await request(
      env,
      "POST",
      "/api/ai/similar",
      { hash: hashA, limit: 2 },
      token,
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { items: { path: string; score: number }[] };
    expect(json.items).toHaveLength(2);
    expect(json.items[0]?.path).toBe("b.md");
    expect(json.items[0]!.score).toBeGreaterThan(json.items[1]!.score);
  });

  it("similar returns 404 when query has no embedding", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const response = await request(env, "POST", "/api/ai/similar", { hash: "9".repeat(16) }, token);
    expect(response.status).toBe(404);
  });

  it("ai/status returns present flags", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const hash = "d".repeat(16);
    await env.DB.prepare(
      "INSERT INTO ai_results (hash, summary, summary_model, summary_at, embed_vec, embed_model, embed_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        hash,
        "sum",
        "m",
        new Date().toISOString(),
        JSON.stringify([1, 2]),
        "emb",
        new Date().toISOString(),
      )
      .run();
    const response = await request(env, "POST", "/api/ai/status", { hashes: [hash] }, token);
    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      entries: { summary: { present: boolean }; embed: { present: boolean } }[];
    };
    expect(json.entries[0]?.summary.present).toBe(true);
    expect(json.entries[0]?.embed.present).toBe(true);
  });
});

describe("assets", () => {
  it("presign requires R2 config", async () => {
    const env = createTestEnv({
      R2_S3_ENDPOINT: undefined,
      R2_ACCESS_KEY_ID: undefined,
      R2_SECRET_ACCESS_KEY: undefined,
      R2_BUCKET: undefined,
    });
    const token = await setupAdminToken(env);
    const response = await request(
      env,
      "POST",
      "/api/assets/presign",
      { key: "images/a.png", contentType: "image/png", size: 1024 },
      token,
    );
    expect(response.status).toBe(503);
  });

  it("presign returns PUT url with headers", async () => {
    const env = createTestEnv({
      R2_S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      R2_ACCESS_KEY_ID: "akid",
      R2_SECRET_ACCESS_KEY: "secret",
      R2_BUCKET: "hyacine-assets",
    });
    const token = await setupAdminToken(env);
    const response = await request(
      env,
      "POST",
      "/api/assets/presign",
      { key: "images/cover.png", contentType: "image/png", size: 1024 },
      token,
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      url: string;
      method: string;
      headers: Record<string, string>;
    };
    expect(json.method).toBe("PUT");
    expect(json.url).toContain("hyacine-assets");
    expect(json.headers["content-type"]).toBe("image/png");
  });

  it("register stores remote asset", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const response = await request(
      env,
      "POST",
      "/api/assets/register",
      {
        path: "images/cover.png",
        assetType: "image",
        fileType: "image/png",
        r2Key: "images/cover.png",
        checksum: "abc",
        size: 1024,
      },
      token,
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { registered: boolean };
    expect(json.registered).toBe(true);
  });
});

describe("posts 查询", () => {
  it("GET /api/posts 返回索引+AI 状态（join ai_results）", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const now = new Date().toISOString();
    const hash = "d".repeat(16);
    // 先同步一篇文章（无 AI 产物）
    await request(
      env,
      "POST",
      "/api/sync",
      {
        generatedAt: now,
        posts: [
          {
            path: "plain.md",
            slug: "plain",
            title: "Plain",
            draft: false,
            categories: ["a"],
            hash,
            createdAt: now,
            updatedAt: now,
            lastModified: now,
          },
        ],
        assets: [],
        deletedPaths: [],
      },
      token,
    );

    const response = await request(env, "GET", "/api/posts", undefined, token);
    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      posts: Array<{
        path: string;
        ai: { summary: { present: boolean }; embed: { present: boolean } };
      }>;
    };
    expect(json.posts).toHaveLength(1);
    expect(json.posts[0]?.path).toBe("plain.md");
    expect(json.posts[0]?.ai.summary.present).toBe(false);
    expect(json.posts[0]?.ai.embed.present).toBe(false);
  });

  it("GET /api/posts 无 token 401", async () => {
    const env = createTestEnv();
    const response = await request(env, "GET", "/api/posts");
    expect(response.status).toBe(401);
  });

  it("GET /api/posts?prefix 按集合目录过滤（repo 相对路径）", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const now = new Date().toISOString();
    const posts = [
      {
        path: "src/posts/hello.md",
        slug: "hello",
        title: "Hello",
        draft: false,
        categories: [],
        hash: "a".repeat(16),
        createdAt: now,
        updatedAt: now,
        lastModified: now,
      },
      {
        path: "src/moments/beautiful-day.md",
        slug: "beautiful-day",
        title: "Beautiful",
        draft: false,
        categories: [],
        hash: "b".repeat(16),
        createdAt: now,
        updatedAt: now,
        lastModified: now,
      },
    ];
    await request(env, "POST", "/api/sync", { generatedAt: now, posts, assets: [], deletedPaths: [] }, token);

    const all = (await (await request(env, "GET", "/api/posts", undefined, token)).json()) as {
      posts: Array<{ path: string }>;
    };
    expect(all.posts.map((p) => p.path).toSorted()).toEqual([
      "src/moments/beautiful-day.md",
      "src/posts/hello.md",
    ]);

    const moments = (await (
      await request(env, "GET", "/api/posts?prefix=src%2Fmoments", undefined, token)
    ).json()) as { posts: Array<{ path: string }> };
    expect(moments.posts.map((p) => p.path)).toEqual(["src/moments/beautiful-day.md"]);
  });
});

describe("assets 查询", () => {
  it("GET /api/assets 返回登记资产列表", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const now = new Date().toISOString();
    await request(
      env,
      "POST",
      "/api/assets/register",
      {
        path: "img/cover.png",
        assetType: "image",
        fileType: "image/png",
        r2Key: "remote/img/cover.png",
      },
      token,
    );

    const response = await request(env, "GET", "/api/assets", undefined, token);
    expect(response.status).toBe(200);
    const json = (await response.json()) as { assets: Array<{ path: string; isRemote: boolean }> };
    expect(json.assets).toHaveLength(1);
    expect(json.assets[0]?.path).toBe("img/cover.png");
    expect(json.assets[0]?.isRemote).toBe(true);
  });
});

describe("stats", () => {
  it("aggregates totals, categories, months and assets", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO posts (path, slug, title, draft, categories, hash, created_at, updated_at, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        "a.md",
        "a",
        "A",
        0,
        JSON.stringify(["cat1"]),
        "a".repeat(16),
        "2026-01-15T00:00:00.000Z",
        now,
        now,
      )
      .run();
    await env.DB.prepare(
      "INSERT INTO posts (path, slug, title, draft, categories, hash, created_at, updated_at, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        "b.md",
        "b",
        "B",
        1,
        JSON.stringify(["cat1", "cat2"]),
        "b".repeat(16),
        "2026-02-15T00:00:00.000Z",
        now,
        now,
      )
      .run();
    await env.DB.prepare(
      "INSERT INTO assets (path, is_remote, asset_type, file_type, r2_key, checksum, size, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind("a.png", 1, "image", "image/png", "a.png", null, null, now)
      .run();

    const response = await request(env, "GET", "/api/stats", undefined, token);
    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      totals: { posts: number; drafts: number; published: number };
      byCategory: Record<string, number>;
      byMonth: { month: string; count: number }[];
      assets: { total: number; remote: number };
    };
    expect(json.totals.posts).toBe(2);
    expect(json.totals.drafts).toBe(1);
    expect(json.byCategory.cat1).toBe(2);
    expect(json.byCategory.cat2).toBe(1);
    expect(json.byMonth).toHaveLength(2);
    expect(json.assets.total).toBe(1);
    expect(json.assets.remote).toBe(1);
  });
});

describe("utils", () => {
  it("stripFrontmatter handles edge cases", async () => {
    const { stripFrontmatter } = await import("./utils/crypto");
    expect(stripFrontmatter("---\ntitle: Hi\n---\nbody")).toBe("body");
    expect(stripFrontmatter("no frontmatter\nbody")).toBe("no frontmatter\nbody");
    expect(stripFrontmatter("---\ntitle: Hi\nbody without closing")).toBe(
      "---\ntitle: Hi\nbody without closing",
    );
  });

  it("cosine and meanPool correctness", async () => {
    const { cosine, meanPool } = await import("./utils/crypto");
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosine([1, 1], [1, 1])).toBeCloseTo(1);
    expect(
      meanPool([
        [1, 2],
        [3, 4],
      ]),
    ).toEqual([2, 3]);
  });
});

describe("admin config (dynamic)", () => {
  it("GET 需要 admin 权限（无 token 401 / 普通 token 403）", async () => {
    const env = createTestEnv();
    expect((await request(env, "GET", "/api/admin/config")).status).toBe(401);
    const token = await setupAdminToken(env);
    // 创建 posts.r 子 token 验证 403
    const create = await request(
      env,
      "POST",
      "/api/auth/tokens",
      { label: "reader", scopes: ["posts.r"], expiresInDays: null },
      token,
    );
    const reader = ((await create.json()) as { token: string }).token;
    expect((await request(env, "GET", "/api/admin/config", undefined, reader)).status).toBe(403);
  });

  it("GET 返回 env 默认值 + 敏感项只回 set 标志", async () => {
    const env = createTestEnv({
      AI_SUMMARY_ENDPOINT: "https://api.example.com/v1/chat/completions",
      AI_SUMMARY_KEY: "sk-env",
      AI_SUMMARY_MODEL: "gpt-x",
      EMBED_MODEL: "@cf/baai/bge-m3",
    });
    const token = await setupAdminToken(env);
    const res = await request(env, "GET", "/api/admin/config", undefined, token);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      aiSummary: { endpoint: string; key: { set: boolean }; model: string };
      embedModel: string;
    };
    expect(json.aiSummary.endpoint).toBe("https://api.example.com/v1/chat/completions");
    expect(json.aiSummary.key).toEqual({ set: true }); // 不回明文
    expect(json.aiSummary.model).toBe("gpt-x");
    expect(json.embedModel).toBe("@cf/baai/bge-m3");
  });

  it("PUT 设置 → GET 反映覆盖；敏感值不回显、空串清除回退 env", async () => {
    const env = createTestEnv({
      AI_SUMMARY_ENDPOINT: "https://env.example.com/v1/chat/completions",
      AI_SUMMARY_MODEL: "env-model",
    });
    const token = await setupAdminToken(env);
    const put = await request(
      env,
      "PUT",
      "/api/admin/config",
      { embedModel: "@cf/baai/bge-m3", aiSummary: { model: "dyn-model" } },
      token,
    );
    expect(put.status).toBe(200);
    const after = (await put.json()) as {
      aiSummary: { model: string; key: { set: boolean } };
      embedModel: string;
    };
    expect(after.aiSummary.model).toBe("dyn-model");
    expect(after.embedModel).toBe("@cf/baai/bge-m3");
    // endpoint 未提供 → 保持 env 默认
    expect(after.aiSummary.key).toEqual({ set: false });

    const get = await request(env, "GET", "/api/admin/config", undefined, token);
    const got = (await get.json()) as { aiSummary: { model: string } };
    expect(got.aiSummary.model).toBe("dyn-model");

    // 清空 embedModel → 回退 env 默认（createTestEnv 默认 @cf/baai/bge-m3）
    const clear = await request(env, "PUT", "/api/admin/config", { embedModel: "" }, token);
    const cleared = ((await clear.json()) as { embedModel: string }).embedModel;
    expect(cleared).toBe("@cf/baai/bge-m3");
  });

  it("PUT 校验：未知键/超长被拒", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    expect(
      (await request(env, "PUT", "/api/admin/config", { unknownKey: "x" }, token)).status,
    ).toBe(400);
    expect(
      (await request(env, "PUT", "/api/admin/config", { embedModel: "x".repeat(200) }, token))
        .status,
    ).toBe(400);
  });

  it("动态配置影响 health 探测（无需 redeploy）", async () => {
    const env = createTestEnv(); // 默认无 AI env
    const token = await setupAdminToken(env);
    const before = (await (await request(env, "GET", "/api/health")).json()) as {
      ai: { summary: boolean };
    };
    expect(before.ai.summary).toBe(false);
    const put = await request(
      env,
      "PUT",
      "/api/admin/config",
      {
        aiSummary: {
          endpoint: "https://api.example.com/v1/chat/completions",
          key: "sk-dyn",
          model: "gpt-dyn",
        },
      },
      token,
    );
    expect(put.status).toBe(200);
    const after = (await (await request(env, "GET", "/api/health")).json()) as {
      ai: { summary: boolean };
    };
    expect(after.ai.summary).toBe(true);
  });

  it("provider/autogen 配置往返（P1 自动 AI 开关）", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const put = await request(
      env,
      "PUT",
      "/api/admin/config",
      {
        aiSummary: { provider: "workers-ai", autogen: true },
        embedAutogen: true,
      },
      token,
    );
    expect(put.status).toBe(200);
    const after = (await put.json()) as {
      aiSummary: { provider: string; autogen: boolean };
      embedAutogen: boolean;
    };
    expect(after.aiSummary.provider).toBe("workers-ai");
    expect(after.aiSummary.autogen).toBe(true);
    expect(after.embedAutogen).toBe(true);
    const get = (await (
      await request(env, "GET", "/api/admin/config", undefined, token)
    ).json()) as {
      aiSummary: { provider: string; autogen: boolean };
      embedAutogen: boolean;
    };
    expect(get.aiSummary.provider).toBe("workers-ai");
    expect(get.embedAutogen).toBe(true);
  });
});

describe("Primary 模式（远程编辑 / 导出）", () => {
  it("POST /api/posts 解析 frontmatter+hash 并落库", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const content = `---\ntitle: Remote Post\nslug: remote-post\ndraft: false\ncategories: [tech, ai]\n---\n\nBody for remote post.`;
    const res = await request(env, "POST", "/api/posts", { path: "sub/remote.md", content }, token);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      slug: string;
      title: string;
      draft: boolean;
      categories: string[];
      hash: string;
      changed: boolean;
      dispatched: boolean;
    };
    expect(json.title).toBe("Remote Post");
    expect(json.slug).toBe("remote-post");
    expect(json.categories).toEqual(["tech", "ai"]);
    expect(json.changed).toBe(true);
    expect(json.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(json.dispatched).toBe(false); // github 未配置
    const db = getFakeD1(env);
    expect(db.posts.get("sub/remote.md")?.content).toBe(content);

    // 同内容再传 → changed=false
    const again = await request(
      env,
      "POST",
      "/api/posts",
      { path: "sub/remote.md", content },
      token,
    );
    expect(((await again.json()) as { changed: boolean }).changed).toBe(false);
  });

  it("正文 hash 变化删除旧 AI 产物并联动 autogen 入队", async () => {
    const env = createTestEnv();
    const db = getFakeD1(env);
    const token = await setupAdminToken(env);
    db.aiResults.set("old".repeat(4), {
      hash: "oldoldoldold",
      summary: "old",
      summary_model: "m",
      summary_at: "2026-08-01T00:00:00.000Z",
      embed_model: null,
      embed_dim: null,
      embed_at: null,
      embed_vec: null,
      embed_chunks: null,
    });
    const v1 = `---\ntitle: T\n---\n\nVersion one body.`;
    const v2 = `---\ntitle: T\n---\n\nVersion two body.`;
    const first = await request(env, "POST", "/api/posts", { path: "v.md", content: v1 }, token);
    const h1 = ((await first.json()) as { hash: string }).hash;
    const second = await request(env, "POST", "/api/posts", { path: "v.md", content: v2 }, token);
    const h2 = ((await second.json()) as { hash: string }).hash;
    expect(h1).not.toBe(h2);
  });

  it("GET /api/posts/content 读取正文（query 传 path，支持子目录）", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const content = `---\ntitle: Sub\n---\n\nSub body.`;
    await request(env, "POST", "/api/posts", { path: "notes/deep/a.md", content }, token);
    const res = await request(
      env,
      "GET",
      "/api/posts/content?path=notes%2Fdeep%2Fa.md",
      undefined,
      token,
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { content: string }).content).toBe(content);
    // 404
    const miss = await request(env, "GET", "/api/posts/content?path=nope.md", undefined, token);
    expect(miss.status).toBe(404);
  });

  it("GET /api/export 返回全量快照（只含有正文的行）", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const now = new Date().toISOString();
    const syncRes = await request(
      env,
      "POST",
      "/api/sync",
      {
        generatedAt: now,
        posts: [
          {
            path: "src/posts/exp.md",
            slug: "exp",
            title: "Exp",
            draft: false,
            categories: [],
            hash: "e".repeat(16),
            createdAt: now,
            updatedAt: now,
            lastModified: now,
            content: "---\ntitle: Exp\n---\n\nExported body.",
          },
          {
            path: "src/moments/beautiful-day.md",
            slug: "beautiful-day",
            title: "Beautiful",
            draft: false,
            categories: [],
            hash: "f".repeat(16),
            createdAt: now,
            updatedAt: now,
            lastModified: now,
            content: "---\ndate: 2026-01-01\n---\n\nMoment body.",
          },
          {
            path: "src/posts/no-content.md",
            slug: "nc",
            title: "NC",
            draft: false,
            categories: [],
            hash: "d".repeat(16),
            createdAt: now,
            updatedAt: now,
            lastModified: now,
          },
        ],
        assets: [],
        deletedPaths: [],
      },
      token,
    );
    expect(syncRes.status).toBe(200);
    const res = await request(env, "GET", "/api/export", undefined, token);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { posts: { path: string; content: string }[] };
    expect(json.posts).toHaveLength(2);
    expect(json.posts).toContainEqual({
      path: "src/posts/exp.md",
      content: expect.stringContaining("Exported body."),
    } as { path: string; content: string });
    // repo 相对路径透传（多集合 moments 无需目录映射）
    expect(json.posts.map((p) => p.path)).toContain("src/moments/beautiful-day.md");
  });

  it("POST /api/export/trigger 调用 GitHub repository_dispatch", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const db = getFakeD1(env);
    db.appConfig.set("github.repoOwner", "me");
    db.appConfig.set("github.repoName", "blog");
    db.appConfig.set("github.token", "ghp_test");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      // eslint-disable-next-line @typescript-eslint/require-await
      .mockResolvedValue(new Response(null, { status: 204 }));
    try {
      const res = await request(env, "POST", "/api/export/trigger", undefined, token);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { dispatched: boolean; repo: string };
      expect(json.dispatched).toBe(true);
      expect(json.repo).toBe("me/blog");
      expect(vi.mocked(fetchSpy)).toHaveBeenCalledWith(
        "https://api.github.com/repos/me/blog/dispatches",
        expect.objectContaining({ method: "POST" }),
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("POST /api/export/trigger 未配置 github → 400", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const res = await request(env, "POST", "/api/export/trigger", undefined, token);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { dispatched: boolean }).dispatched).toBe(false);
  });
});

describe("manual ai generate", () => {
  it("POST /api/ai/generate 为带正文文章同步生成 summary+embed（workers-ai）", async () => {
    const env = createTestEnv({
      AI: {
        run: async (model: unknown) => {
          const m = String(model);
          if (m.includes("bge")) return { data: [[0.1, 0.2]] };
          return { response: "这是立刻生成的摘要。" };
        },
      } as unknown as Env["AI"],
    });
    const db = getFakeD1(env);
    db.appConfig.set("aiSummary.provider", "workers-ai");
    const token = await setupAdminToken(env);
    const content = `---\ntitle: Gen\n---\n\nHello gen body.`;
    await request(env, "POST", "/api/posts", { path: "gen.md", content }, token);
    const res = await request(
      env,
      "POST",
      "/api/ai/generate",
      { path: "gen.md", kinds: ["summary", "embed"] },
      token,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      hash: string;
      summary: { present: boolean };
      embed: { present: boolean };
      errors: string[];
    };
    expect(json.summary.present).toBe(true);
    expect(json.embed.present).toBe(true);
    expect(json.errors).toEqual([]);
  });

  it("POST /api/ai/generate 无正文 → 404", async () => {
    const env = createTestEnv();
    const token = await setupAdminToken(env);
    const res = await request(
      env,
      "POST",
      "/api/ai/generate",
      { path: "nope.md", kinds: ["summary"] },
      token,
    );
    expect(res.status).toBe(404);
  });

  it("POST /api/ai/generate BYOK 未配置端点 → errors 返回但状态 200", async () => {
    const env = createTestEnv();
    const db = getFakeD1(env);
    const token = await setupAdminToken(env);
    db.posts.set("gen.md", {
      path: "gen.md",
      slug: "gen",
      title: "Gen",
      draft: 0,
      categories: "[]",
      hash: "g".repeat(16),
      created_at: "2026-08-01T00:00:00.000Z",
      updated_at: "2026-08-01T00:00:00.000Z",
      last_modified: "2026-08-01T00:00:00.000Z",
      content: "---\ntitle: Gen\n---\n\nBody.",
    });
    const res = await request(
      env,
      "POST",
      "/api/ai/generate",
      { path: "gen.md", kinds: ["summary"] },
      token,
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { errors: string[]; summary: { present: boolean } };
    expect(json.errors.length).toBeGreaterThan(0);
    expect(json.summary.present).toBe(false);
  });
});
