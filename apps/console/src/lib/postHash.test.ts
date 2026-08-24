import { describe, expect, it } from "vitest";
import { postBodyHash } from "./postHash";

describe("postBodyHash", () => {
  it("frontmatter 变更不影响 hash", () => {
    const base = `---\ntitle: T\ndraft: false\n---\n\nBody text here.\n`;
    const materialized = `---\ntitle: T\ndraft: false\nsummary: 摘要\nsummarySourceHash: x\n---\n\nBody text here.\n`;
    expect(postBodyHash(base)).toBe(postBodyHash(materialized));
  });

  it("正文变更改变 hash", () => {
    const a = `---\ntitle: T\n---\n\nBody A\n`;
    const b = `---\ntitle: T\n---\n\nBody B\n`;
    expect(postBodyHash(a)).not.toBe(postBodyHash(b));
  });

  it("返回 16 hex", () => {
    const h = postBodyHash(`---\ntitle: T\n---\n\nHello\n`);
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });
});
