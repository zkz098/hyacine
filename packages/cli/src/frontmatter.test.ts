import { describe, expect, it } from "vitest";
import {
  hasUpToDateSummary,
  materializeSummary,
  parseFrontmatter,
  stringifyFrontmatter,
} from "./frontmatter";

describe("frontmatter", () => {
  it("parse and stringify roundtrip", () => {
    const raw = `---\ntitle: Hi\nslug: hi\n---\n\nHello world\n`;
    const parsed = parseFrontmatter(raw);
    expect(parsed.data.title).toBe("Hi");
    expect(parsed.content.trim()).toBe("Hello world");
    const out = stringifyFrontmatter(parsed.data, parsed.content);
    expect(out).toContain("title: Hi");
  });

  it("materializeSummary writes fields and is idempotent", () => {
    const raw = `---\ntitle: Test\n---\n\nBody\n`;
    const hash = "a".repeat(16);
    const updated = materializeSummary(
      raw,
      "my summary",
      "gpt-4",
      hash,
      "2026-01-01T00:00:00.000Z",
    );
    expect(updated).toContain("summary: my summary");
    expect(updated).toContain("summaryModel: gpt-4");
    expect(updated).toContain(hash);
    const reparsed = parseFrontmatter(updated);
    expect(reparsed.data.summary).toBe("my summary");
    expect(hasUpToDateSummary(updated, hash)).toBe(true);
    expect(hasUpToDateSummary(updated, "b".repeat(16))).toBe(false);
  });

  it("materialize preserves other fields", () => {
    const raw = `---\ntitle: T\ncategories: [a]\ncustom: 123\n---\n\nX\n`;
    const out = materializeSummary(raw, "s", "m", "a".repeat(16), "2026-01-01T00:00:00.000Z");
    expect(out).toContain("custom: 123");
    expect(out).toContain("categories:");
  });

  it("日期字符串不被重写为 ISO 时间戳（core schema 保真）", () => {
    const raw = `---\ntitle: T\ndate: 2026-08-01\n---\n\nX\n`;
    const out = materializeSummary(raw, "s", "m", "a".repeat(16), "2026-01-01T00:00:00.000Z");
    expect(out).toContain("date: 2026-08-01");
    expect(out).not.toContain("2026-08-01T00:00:00");
  });
});
