import { describe, expect, it } from "vitest";
import { autoSlug, containsCjk, displaySlug, sanitizeExplicitSlug } from "./slug";

describe("slug 策略", () => {
  it("含中文判断", () => {
    expect(containsCjk("你好世界")).toBe(true);
    expect(containsCjk("Hello World")).toBe(false);
  });

  it("autoSlug: 中文标题转拼音", () => {
    expect(autoSlug("你好世界")).toBe("ni-hao-shi-jie");
    expect(autoSlug("  你好 世界 ")).toBe("ni-hao-shi-jie");
  });

  it("autoSlug: 中英文混排时保持英文单词完整性", () => {
    expect(autoSlug("自定义 Markdown 语法演示")).toBe("zi-ding-yi-markdown-yu-fa-yan-shi");
    expect(autoSlug("ShokaX 主题 2.0 发布")).toBe("shokax-zhu-ti-2-0-fa-bu");
    expect(autoSlug("Vue3 与 TypeScript 实战")).toBe("vue3-yu-typescript-shi-zhan");
  });

  it("autoSlug: ASCII 标题原样", () => {
    expect(autoSlug("Hello World!")).toBe("hello-world");
  });

  it("autoSlug: 纯标点兜底时间戳", () => {
    const s = autoSlug("！！！");
    expect(s).toMatch(/^post-\d+$/);
  });

  it("sanitizeExplicitSlug: 明写中文保留", () => {
    expect(sanitizeExplicitSlug("好的标题")).toBe("好的标题");
    expect(sanitizeExplicitSlug("My 标题 Two")).toBe("my-标题-two");
  });

  it("sanitizeExplicitSlug: 纯 '-' 退化值视为空", () => {
    expect(sanitizeExplicitSlug("------")).toBe("");
    expect(sanitizeExplicitSlug("a--b")).toBe("a-b");
  });

  it("displaySlug: 显式优先，退化回自动", () => {
    expect(displaySlug("我的文章", "随便")).toBe("我的文章");
    expect(displaySlug("------", "你好")).toBe("ni-hao");
    expect(displaySlug(undefined, "你好")).toBe("ni-hao");
  });
});
