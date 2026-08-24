import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { HyacineClient } from "@hyacine/contract";
import { materializeSummary } from "./frontmatter";
import { postBodyHash } from "./hash";

function mockFetchForSummary(expectedSummary: string): typeof fetch {
  const fn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    if (urlStr.includes("/api/ai/summary")) {
      const rawBody = typeof init?.body === "string" ? init.body : "{}";
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test mock body shape
      const body = JSON.parse(rawBody) as { hash: string; content: string };
      return new Response(
        JSON.stringify({
          hash: body.hash,
          summary: expectedSummary,
          model: "mock-model",
          sourceHash: body.hash,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ error: { code: "not_found", message: "not found" } }), {
      status: 404,
    });
  });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- vi.fn mock to fetch
  return fn as unknown as typeof fetch;
}

describe("ai materialize via mock client", () => {
  it("calls api and writes frontmatter", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "hyacine-ai-"));
    const file = join(tmp, "post.md");
    const raw = `---\ntitle: Hello\n---\n\nBody content here.\n`;
    writeFileSync(file, raw, "utf8");
    const hash = postBodyHash(raw);
    const client = new HyacineClient({
      baseUrl: "https://api.example.com",
      token: "tok",
      fetch: mockFetchForSummary("AI summary text"),
    });
    const res = await client.aiSummary({ hash, content: raw });
    expect(res.summary).toBe("AI summary text");
    const updated = materializeSummary(
      raw,
      res.summary,
      res.model,
      res.sourceHash,
      new Date().toISOString(),
    );
    writeFileSync(file, updated, "utf8");
    const reread = readFileSync(file, "utf8");
    expect(reread).toContain("summary: AI summary text");
    expect(reread).toContain("summaryModel: mock-model");
    rmSync(tmp, { recursive: true, force: true });
  });

  it("materialize is idempotent when hash matches", () => {
    const raw = `---\ntitle: T\n---\n\nX\n`;
    const hash = postBodyHash(raw);
    const once = materializeSummary(raw, "s", "m", hash, new Date().toISOString());
    const twice = materializeSummary(once, "s", "m", hash, new Date().toISOString());
    expect(twice).toContain("summary: s");
  });
});
