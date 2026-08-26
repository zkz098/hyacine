import { describe, expect, it } from "vitest";
import {
  ConfigUpdateRequestSchema,
  DEFAULT_PROJECT_CONFIG,
  parseProjectConfig,
  type ProjectConfigSchema,
} from "./config";
import { z } from "zod";

describe("ProjectConfigSchema / parseProjectConfig", () => {
  it("缺省/空对象回退默认值", () => {
    expect(parseProjectConfig(undefined)).toEqual(DEFAULT_PROJECT_CONFIG);
    expect(parseProjectConfig({})).toEqual(DEFAULT_PROJECT_CONFIG);
  });

  it("解析合法 yaml 对象（未知键忽略）", () => {
    const cfg = parseProjectConfig({
      contentDir: "content/posts",
      assetsDir: "static/assets",
      postExtension: [".mdx"],
      themeConfigPath: "astro.config.mjs",
      extra: "ignored",
    });
    expect(cfg).toMatchObject({
      contentDir: "content/posts",
      assetsDir: "static/assets",
      postExtension: [".mdx"],
      themeConfigPath: "astro.config.mjs",
    });
  });

  it("部分字段补默认", () => {
    const cfg = parseProjectConfig({ contentDir: "posts" });
    expect(cfg.contentDir).toBe("posts");
    expect(cfg.assetsDir).toBe(DEFAULT_PROJECT_CONFIG.assetsDir);
  });

  it("非法类型回退默认（不抛）", () => {
    // contentDir 非字符串 → 整体回退默认
    expect(parseProjectConfig({ contentDir: 123 })).toEqual(DEFAULT_PROJECT_CONFIG);
  });

  it("schema 类型可推导", () => {
    const typecheck: z.infer<typeof ProjectConfigSchema> = {
      contentDir: "a",
      assetsDir: "b",
      postExtension: [".md"],
      themeConfigPath: null,
    };
    expect(typecheck.contentDir).toBe("a");
  });
});

describe("ConfigUpdateRequestSchema", () => {
  it("接受部分更新（敏感字段与可选块）", () => {
    const req = ConfigUpdateRequestSchema.parse({
      aiSummary: { endpoint: "https://x/v1/chat/completions", key: "" },
      embedModel: "@cf/baai/bge-m3",
      r2: { bucket: "hyacine-assets" },
    });
    expect(req.aiSummary?.endpoint).toBe("https://x/v1/chat/completions");
    expect(req.aiSummary?.key).toBe("");
    expect(req.embedModel).toBe("@cf/baai/bge-m3");
    expect(req.r2?.bucket).toBe("hyacine-assets");
  });

  it("接受 sync 安全配置更新", () => {
    const req = ConfigUpdateRequestSchema.parse({
      sync: {
        boundProjectId: "github:user/my-blog",
        maxDeleteRatio: 0.3,
        maxDeleteLimit: 10,
      },
    });
    expect(req.sync?.boundProjectId).toBe("github:user/my-blog");
    expect(req.sync?.maxDeleteRatio).toBe(0.3);
    expect(req.sync?.maxDeleteLimit).toBe(10);
  });
});
