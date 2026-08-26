import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { Posts } from "./Posts";
import { apiStore } from "../store/api";

function mockPostsFetch(): (url: string) => Promise<Response> {
  const now = new Date().toISOString();
  return (url: string) => {
    if (String(url).includes("/api/posts")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            posts: [
              {
                path: "a.md",
                slug: "a",
                title: "Post A",
                draft: false,
                categories: ["test"],
                hash: "a".repeat(16),
                createdAt: now,
                updatedAt: now,
                lastModified: now,
                ai: {
                  summary: { present: true, model: "m1", at: now },
                  embed: { present: false, model: null, at: null },
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    }
    return Promise.resolve(new Response("{}", { status: 404 }));
  };
}

describe("Posts page", () => {
  beforeEach(() => {
    localStorage.clear();
    apiStore.setBaseUrl("https://example.com");
    apiStore.setToken("tok");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders posts from api", async () => {
    const fetchMock = mockPostsFetch();
    vi.stubGlobal("fetch", fetchMock);

    const { findByText } = render(() => <Posts />);

    // oxlint-disable-next-line typescript/unbound-method -- jest-dom matcher
    expect(await findByText("Post A")).toBeInTheDocument();
    // oxlint-disable-next-line typescript/unbound-method -- jest-dom matcher
    expect(await findByText("a")).toBeInTheDocument();
  });

  it("shows empty hint when no posts", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ posts: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { findByText } = render(() => <Posts />);

    // oxlint-disable-next-line typescript/unbound-method -- jest-dom matcher
    expect(await findByText("暂无文章，请先通过 CLI 同步")).toBeInTheDocument();
  });

  it("allows opening post in read-only mode in Replica mode", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes("/api/health")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              version: "0.1.0",
              ai: { summary: true, embed: true },
              r2: true,
              github: false,
              primary: { available: false, reason: "replica" },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      }
      if (String(url).includes("/api/posts/content")) {
        return Promise.resolve(
          new Response(JSON.stringify({ path: "a.md", content: "# Post A Content" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      return mockPostsFetch()(url);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(() => <Posts />);

    const readOnlyBtn = await screen.findByText("查看 (只读)");
    expect(readOnlyBtn).toBeInTheDocument();
    fireEvent.click(readOnlyBtn);

    expect(await screen.findByText("只读模式 (Replica)")).toBeInTheDocument();
    expect(await screen.findByText("文章正文 (只读)：a.md")).toBeInTheDocument();
    expect(screen.getByText("只读模式（禁止保存）")).toBeInTheDocument();
  });
});
