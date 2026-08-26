import { describe, expect, it } from "vitest";
import {
  collectRuntimeEntries,
  defineConfig,
  definePlugin,
  groupEntriesBySlot,
  normalizeInjectPoints,
} from "./index";

describe("plugin-core config & manifest", () => {
  it("归一化 injectPoints 简写与高级对象", () => {
    const raw = {
      "footer-status": ".footer-status",
      "post-footer": { selector: "#comments", position: "before" as const, order: 5 },
    };
    const normalized = normalizeInjectPoints(raw);
    expect(normalized["footer-status"]).toEqual({
      selector: ".footer-status",
      position: "append",
      order: 0,
    });
    expect(normalized["post-footer"]).toEqual({
      selector: "#comments",
      position: "before",
      order: 5,
    });
  });

  it("defineConfig 校验合法配置", () => {
    const config = defineConfig({
      injectPoints: { layout: "body" },
      plugins: [],
    });
    expect(config.injectPoints.layout).toBe("body");
    expect(config.postCollection).toBe("posts");
  });

  it("definePlugin 校验 Manifest 并分类 entries", () => {
    const pluginA = definePlugin({
      name: "plugin-a",
      version: "1.0.0",
      minRenderCapability: "runtime-only",
      entry: [
        {
          name: "entry-1",
          type: "runtime-only",
          path: "./runtime.ts",
          injectPoint: "layout",
          order: 10,
        },
      ],
    });

    const pluginB = definePlugin({
      name: "plugin-b",
      version: "1.0.0",
      minRenderCapability: "ssr",
      entry: [
        {
          name: "entry-2",
          type: "ssr",
          path: "./Widget.astro",
          injectPoint: "layout",
          order: 2,
        },
      ],
    });

    const grouped = groupEntriesBySlot([pluginA, pluginB]);
    const layoutEntries = grouped.get("layout")!;
    expect(layoutEntries.length).toBe(2);
    // order 2 应当排在 order 10 前面
    expect(layoutEntries[0]?.name).toBe("entry-2");
    expect(layoutEntries[1]?.name).toBe("entry-1");

    const runtimeOnly = collectRuntimeEntries([pluginA, pluginB]);
    expect(runtimeOnly.length).toBe(1);
    expect(runtimeOnly[0]?.name).toBe("entry-1");
  });
});
