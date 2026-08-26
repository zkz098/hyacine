import { describe, it, expect, vi } from "vitest";
import { hyacineLoader } from "../src/astro/loader";
import type { AstroDataStore, AstroDataStoreEntry, AstroLoaderContext } from "../src/astro/types";

function createMockDataStore(): AstroDataStore {
  const map = new Map<string, AstroDataStoreEntry>();
  return {
    get: (id: string) => map.get(id),
    set: (entry: AstroDataStoreEntry) => {
      map.set(entry.id, entry);
    },
    has: (id: string) => map.has(id),
    delete: (id: string) => {
      map.delete(id);
    },
    clear: () => map.clear(),
    keys: () => Array.from(map.keys()),
    values: () => Array.from(map.values()),
    entries: () => Array.from(map.entries()),
  };
}

describe("hyacineLoader (Astro Live Collections)", () => {
  it("fetches posts from D1, parses frontmatter and injects AI metadata into Astro store", async () => {
    const mockPosts = [
      {
        path: "src/posts/post-1.md",
        content: `---
title: First Post
date: 2026-08-26
categories: ["Tech"]
tags: ["Astro"]
ai_summary: This is materialized AI summary.
---
# Hello World
This is first post content.`,
      },
      {
        path: "src/posts/post-2.md",
        content: `---
title: Second Post
date: 2026-08-27
categories: ["Tech"]
---
# Another Post
Second post content.`,
      },
    ];

    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/api/export")) {
        return new Response(
          JSON.stringify({
            generatedAt: new Date().toISOString(),
            posts: mockPosts,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/posts")) {
        return new Response(
          JSON.stringify({
            posts: [
              {
                path: "src/posts/post-1.md",
                slug: "post-1",
                title: "First Post",
                draft: false,
                categories: ["Tech"],
                hash: "hash-1",
                createdAt: "2026-08-26T00:00:00Z",
                updatedAt: "2026-08-26T00:00:00Z",
                lastModified: "2026-08-26T00:00:00Z",
                ai: {
                  summary: { present: true, model: "gpt-4o", at: "2026-08-26" },
                  embed: { present: true, model: "bge-m3", at: "2026-08-26" },
                },
              },
              {
                path: "src/posts/post-2.md",
                slug: "post-2",
                title: "Second Post",
                draft: false,
                categories: ["Tech"],
                hash: "hash-2",
                createdAt: "2026-08-27T00:00:00Z",
                updatedAt: "2026-08-27T00:00:00Z",
                lastModified: "2026-08-27T00:00:00Z",
                ai: {
                  summary: { present: false, model: null, at: null },
                  embed: { present: false, model: null, at: null },
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("Not found", { status: 404 });
    }) as unknown as typeof fetch;

    const store = createMockDataStore();
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const context: AstroLoaderContext = {
      store,
      meta: {
        get: vi.fn(),
        set: vi.fn(),
      },
      logger,
      parseData: async ({ data }) => data,
      generateDigest: (data) => `digest-${JSON.stringify(data).slice(0, 10)}`,
    };

    const loader = hyacineLoader({
      apiUrl: "https://api.hyacine.example.com",
      token: "test-token",
      customFetch: mockFetch,
    });

    await loader.load(context);

    // 验证写入的条目
    expect(store.has("post-1")).toBe(true);
    expect(store.has("post-2")).toBe(true);

    const post1 = store.get("post-1");
    expect(post1?.data.title).toBe("First Post");
    expect(post1?.body).toContain("# Hello World");
    expect(post1?.data.ai).toBeDefined();

    // 验证 AI 摘要提取
    const aiData = post1?.data.ai as { summary?: { summary?: string } };
    expect(aiData.summary?.summary).toBe("This is materialized AI summary.");
  });

  it("cleans up deleted posts from Astro data store", async () => {
    const store = createMockDataStore();
    // 假设 store 里原本有一篇旧文章
    store.set({
      id: "old-deleted-post",
      data: { title: "Old Post" },
      body: "Old body",
    });

    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/api/export")) {
        return new Response(
          JSON.stringify({
            generatedAt: new Date().toISOString(),
            posts: [
              {
                path: "src/posts/current.md",
                content: "---\ntitle: Current\n---\nBody",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/posts")) {
        return new Response(JSON.stringify({ posts: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    }) as unknown as typeof fetch;

    const context: AstroLoaderContext = {
      store,
      meta: { get: vi.fn(), set: vi.fn() },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      parseData: async ({ data }) => data,
      generateDigest: () => "d1",
    };

    const loader = hyacineLoader({
      apiUrl: "https://api.hyacine.example.com",
      customFetch: mockFetch,
    });

    await loader.load(context);

    expect(store.has("current")).toBe(true);
    expect(store.has("old-deleted-post")).toBe(false); // 已被删除
  });
});
