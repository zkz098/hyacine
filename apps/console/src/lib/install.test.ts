import { describe, expect, it } from "vitest";
import { resolveCloneTarget, resolveCloneUrl } from "./install";

describe("install 克隆源解析", () => {
  it("github 原样", () => {
    expect(resolveCloneUrl("https://github.com/theme-shoka-x/astro-blog-shokax", "github")).toBe(
      "https://github.com/theme-shoka-x/astro-blog-shokax",
    );
  });

  it("gh-proxy 前缀拼接（保留完整 URL，代理需要）", () => {
    expect(resolveCloneUrl("https://github.com/theme-shoka-x/astro-blog-shokax", "gh-proxy")).toBe(
      "https://gh-proxy.org/https://github.com/theme-shoka-x/astro-blog-shokax",
    );
    expect(resolveCloneUrl("https://github.com/a/b", "gh-proxy-v6")).toBe(
      "https://v6.gh-proxy.org/https://github.com/a/b",
    );
  });

  it("空地址返回空串", () => {
    expect(resolveCloneUrl("  ", "github")).toBe("");
  });

  it("resolveCloneTarget: 空目录直接用，否则加后缀子目录", async () => {
    expect(await resolveCloneTarget("D:/blog", "astro-blog-shokax", async () => false)).toBe(
      "D:/blog",
    );
    const occupied = new Set(["D:/blog", "D:/blog/astro-blog-shokax"]);
    const pick = async (p: string): Promise<boolean> => occupied.has(p);
    expect(await resolveCloneTarget("D:/blog", "astro-blog-shokax", pick)).toBe(
      "D:/blog/astro-blog-shokax-1",
    );
  });
});
