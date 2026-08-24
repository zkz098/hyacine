import { describe, expect, it } from "vitest";
import { contentHash, postBodyHash } from "./hash";

describe("contentHash", () => {
  it("returns 16 hex chars", () => {
    const h = contentHash("hello");
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });
  it("deterministic", () => {
    expect(contentHash("same")).toBe(contentHash("same"));
  });
  it("different for different content", () => {
    expect(contentHash("a")).not.toBe(contentHash("b"));
  });
});

const RAW_TEMPLATE = (extra: string) => `---\ntitle: T\n${extra}---\n\nBody text here.\n`;

describe("postBodyHash", () => {
  it("frontmatter 变更不影响 hash（防物化死循环的关键）", () => {
    const base = RAW_TEMPLATE("draft: false\n");
    const materialized = RAW_TEMPLATE("draft: false\nsummary: 摘要\nsummarySourceHash: x\n");
    expect(postBodyHash(base)).toBe(postBodyHash(materialized));
  });

  it("正文变更改变 hash", () => {
    const a = RAW_TEMPLATE("draft: false\n");
    const b = RAW_TEMPLATE("draft: false\n");
    const withBodyChanged = b.replace("Body text here.", "Body text changed.");
    expect(postBodyHash(a)).not.toBe(postBodyHash(withBodyChanged));
  });
});
