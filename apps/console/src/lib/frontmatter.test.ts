import { describe, expect, it } from "vitest";
import { hasUpToDateSummary, materializeSummary, parseFrontmatter } from "./frontmatter";

describe("frontmatter core schema", () => {
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
