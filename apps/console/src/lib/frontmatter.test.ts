import { describe, expect, it } from "vitest";
import { hasUpToDateSummary, materializeSummary, parseFrontmatter } from "./frontmatter";
import { installBufferPolyfill } from "./buffer";

describe("frontmatter core schema", () => {
  it("渲染进程无全局 Buffer 时仍能解析（回归：gray-matter Buffer is not defined）", () => {
    // 模拟浏览器/WebView：先删掉全局 Buffer，再装 polyfill
    const g = globalThis as unknown as { Buffer?: unknown };
    const had = g.Buffer;
    delete g.Buffer;
    try {
      installBufferPolyfill();
      const raw = `---\ntitle: T\ncategories: [a, b]\n---\n\nBody\n`;
      const parsed = parseFrontmatter(raw);
      expect(parsed.data.title).toBe("T");
      expect(parsed.content).toContain("Body");
    } finally {
      g.Buffer = had;
    }
  });

  it("date 字符串不被重写为 ISO 时间戳", () => {
    const raw = `---\ntitle: T\ndate: 2026-08-01\n---\n\nX\n`;
    const out = materializeSummary(raw, "s", "m", "a".repeat(16), "2026-01-01T00:00:00.000Z");
    expect(out).toContain("date: 2026-08-01");
    expect(out).not.toContain("2026-08-01T00:00:00");
  });

  it("parse 保留未知键", () => {
    const raw = `---\ntitle: T\ncustom: 123\n---\n\nBody\n`;
    const parsed = parseFrontmatter(raw);
    expect(parsed.data.custom).toBe(123);
  });

  it("materialize 写入四键", () => {
    const raw = `---\ntitle: T\n---\n\nBody\n`;
    const hash = "b".repeat(16);
    const out = materializeSummary(
      raw,
      "my summary",
      "e2e-model",
      hash,
      "2026-01-01T00:00:00.000Z",
    );
    expect(out).toContain("summary: my summary");
    expect(out).toContain("summaryModel: e2e-model");
    expect(out).toContain(hash);
    expect(hasUpToDateSummary(out, hash)).toBe(true);
  });
});
