import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("lowercases and replaces spaces", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });
  it("removes special chars and collapses hyphens", () => {
    expect(slugify("Hello__World!!")).toBe("hello-world");
  });
  it("returns untitled for empty", () => {
    expect(slugify("   ")).toBe("untitled");
  });
  it("handles chinese fallback to hyphen stripped", () => {
    expect(slugify("你好世界")).toBe("untitled");
  });
});
