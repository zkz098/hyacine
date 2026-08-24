import { describe, expect, it } from "vitest";
import { contentHash } from "./hash";

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
