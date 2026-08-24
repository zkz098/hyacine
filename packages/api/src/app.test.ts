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
    };
    expect(json.ok).toBe(true);
    expect(json.ai.summary).toBe(true);
    expect(json.ai.embed).toBe(true);
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
