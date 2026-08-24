import { describe, expect, it, vi } from "vitest";
import { HyacineApiError, HyacineClient } from "./index";

interface CallRecord {
  url: string;
  init?: RequestInit;
}

function makeFetchMock(handler: (input: RequestInfo | URL, init?: RequestInit) => Response) {
  const calls: CallRecord[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return Promise.resolve(handler(input, init));
  });
  return { fetchMock, calls };
}

function headersOf(init?: RequestInit): Record<string, string> {
  const headers = init?.headers;
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return headers ?? {};
}

function bodyOf(init?: RequestInit): unknown {
  const body = init?.body;
  if (typeof body === "string") {
    return JSON.parse(body) as unknown;
  }
  return undefined;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function healthBody() {
  return {
    ok: true as const,
    version: "0.1.0",
    needsSetup: false,
    ai: { summary: true, embed: true },
  };
}

describe("HyacineClient", () => {
  it("baseUrl 去尾斜杠并拼接路径，带 Bearer 头", async () => {
    const { fetchMock, calls } = makeFetchMock(() => jsonResponse(200, healthBody()));
    const client = new HyacineClient({
      baseUrl: "https://api.example.com/",
      token: "tok-123",
      fetch: fetchMock,
    });

    const health = await client.health();
    expect(health.ok).toBe(true);
    expect(calls[0]?.url).toBe("https://api.example.com/api/health");
    expect(headersOf(calls[0]?.init)).toMatchObject({ authorization: "Bearer tok-123" });
  });

  it("postsList 走 GET /api/posts 并渲染列表项", async () => {
    const now = new Date().toISOString();
    const { fetchMock, calls } = makeFetchMock(() =>
      jsonResponse(200, {
        posts: [
          {
            path: "p.md",
            slug: "p",
            title: "P",
            draft: false,
            categories: [],
            hash: "a".repeat(16),
            createdAt: now,
            updatedAt: now,
            lastModified: now,
            ai: {
              summary: { present: true, model: "m", at: now },
              embed: { present: false, model: null, at: null },
            },
          },
        ],
      }),
    );
    const client = new HyacineClient({
      baseUrl: "https://api.example.com",
      token: "t",
      fetch: fetchMock,
    });

    const res = await client.postsList();
    expect(res.posts).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.example.com/api/posts");
    expect(calls[0]?.init?.method).toBe("GET");
  });

  it("assetsList 走 GET /api/assets", async () => {
    const { fetchMock, calls } = makeFetchMock(() =>
      jsonResponse(200, {
        assets: [
          {
            path: "a.png",
            isRemote: true,
            assetType: "image",
            fileType: "image/png",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );
    const client = new HyacineClient({
      baseUrl: "https://api.example.com",
      token: "t",
      fetch: fetchMock,
    });

    const res = await client.assetsList();
    expect(res.assets[0]?.path).toBe("a.png");
    expect(calls[0]?.url).toBe("https://api.example.com/api/assets");
  });

  it("POST 请求序列化 JSON 请求体并按契约渲染", async () => {
    const { fetchMock, calls } = makeFetchMock(() =>
      jsonResponse(200, {
        accepted: { posts: 1, assets: 0 },
        changedHashes: ["a".repeat(16)],
        unchangedHashes: [],
        deletedPaths: [],
        ai: { needs: [{ hash: "a".repeat(16), path: "x.md", reason: "both" }] },
      }),
    );
    const client = new HyacineClient({
      baseUrl: "https://api.example.com",
      token: "t",
      fetch: fetchMock,
    });
    const now = new Date().toISOString();
    const requestBody = {
      generatedAt: now,
      posts: [
        {
          path: "x.md",
          slug: "x",
          title: "X",
          draft: false,
          categories: [],
          hash: "a".repeat(16),
          createdAt: now,
          updatedAt: now,
          lastModified: now,
        },
      ],
      assets: [],
      deletedPaths: ["gone.md"],
    };

    const res = await client.syncUpload(requestBody);

    expect(res.ai.needs).toHaveLength(1);
    expect(res.accepted.posts).toBe(1);
    expect(bodyOf(calls[0]?.init)).toEqual(requestBody);
  });

  it("非 2xx 按错误信封抛 HyacineApiError", async () => {
    const { fetchMock } = makeFetchMock(() =>
      jsonResponse(401, { error: { code: "unauthorized", message: "token 无效" } }),
    );
    const client = new HyacineClient({
      baseUrl: "https://api.example.com",
      token: "bad",
      fetch: fetchMock,
    });

    await expect(client.listTokens()).rejects.toMatchObject({
      name: "HyacineApiError",
      status: 401,
      code: "unauthorized",
    });
  });

  it("网络失败包装为 network_error", async () => {
    const client = new HyacineClient({
      baseUrl: "https://api.example.com",
      fetch: (() => Promise.reject(new Error("ECONNREFUSED"))) as typeof fetch,
    });

    await expect(client.health()).rejects.toMatchObject({ code: "network_error" });
  });

  it("响应不符合契约抛 invalid_response", async () => {
    const { fetchMock } = makeFetchMock(() => jsonResponse(200, { ok: false, junk: true }));
    const client = new HyacineClient({ baseUrl: "https://api.example.com", fetch: fetchMock });

    await expect(client.health()).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("setToken 动态注入与清空", async () => {
    const { fetchMock, calls } = makeFetchMock(() => jsonResponse(200, healthBody()));
    const client = new HyacineClient({ baseUrl: "https://api.example.com", fetch: fetchMock });

    client.setToken("abc");
    await client.health();
    client.setToken(null);
    await client.health();

    expect(headersOf(calls[0]?.init)).toMatchObject({ authorization: "Bearer abc" });
    expect(headersOf(calls[1]?.init).authorization).toBeUndefined();
  });

  it("错误信封含 details 并透传", async () => {
    const { fetchMock } = makeFetchMock(() =>
      jsonResponse(400, {
        error: { code: "bad_request", message: "参数错误", details: { field: "key" } },
      }),
    );
    const client = new HyacineClient({
      baseUrl: "https://api.example.com",
      token: "t",
      fetch: fetchMock,
    });

    const promise = client.presign({ key: "img/a.png", contentType: "image/png", size: 1024 });
    await expect(promise).rejects.toBeInstanceOf(HyacineApiError);
    await expect(promise).rejects.toMatchObject({ code: "bad_request", details: { field: "key" } });
  });
});
