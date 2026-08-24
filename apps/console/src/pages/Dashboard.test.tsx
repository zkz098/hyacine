// oxlint-disable typescript/unbound-method, typescript/no-unnecessary-type-conversion
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render } from "@solidjs/testing-library";
import { Dashboard } from "./Dashboard";
import { apiStore } from "../store/api";

describe("Dashboard", () => {
  beforeEach(() => {
    localStorage.clear();
    apiStore.setBaseUrl("https://example.com");
    apiStore.setToken("tok");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders stats", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes("/api/stats")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              totals: { posts: 5, drafts: 1, published: 4 },
              byCategory: { test: 3 },
              byMonth: [{ month: "2026-08", count: 5 }],
              assets: { total: 2, remote: 1 },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { findByText } = render(() => <Dashboard />);

    // oxlint-disable-next-line typescript/unbound-method -- jest-dom matcher
    expect(await findByText("5")).toBeInTheDocument();
  });
});
