// oxlint-disable typescript/unbound-method, typescript/no-unnecessary-type-conversion, typescript/no-unsafe-type-assertion
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render } from "@solidjs/testing-library";
import { Posts } from "./Posts";
import { apiStore } from "../store/api";

function mockPostsFetch(): ReturnType<typeof vi.fn> {
  const now = new Date().toISOString();
  return vi.fn((url: string) => {
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
  });
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
});
