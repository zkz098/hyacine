import { describe, expect, it } from "vitest";
import {
  collectRuntimeEntries,
  defineConfig,
  definePlugin,
  generatePaletteCSS,
  groupEntriesBySlot,
  mergeThemePalettes,
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

  it("mergeThemePalettes 合并多插件调色板并支持后定义覆盖", () => {
    const pluginA = definePlugin({
      name: "theme-base",
      version: "1.0.0",
      minRenderCapability: "runtime-only",
      theme: {
        palette: {
          root: { "--font-sans": "Inter, sans-serif", primary: "#3b82f6" },
          light: { "bg-color": "#ffffff", text: "#111827" },
          dark: { "bg-color": "#18181b", text: "#f4f4f5" },
          cssFiles: ["./styles/base.css"],
        },
      },
    });

    const pluginB = definePlugin({
      name: "theme-override",
      version: "1.0.0",
      minRenderCapability: "runtime-only",
      theme: {
        palette: {
          root: { primary: "#6366f1" },
          dark: { "bg-color": "#09090b" },
          cssFiles: ["./styles/base.css", "./styles/override.css"],
          customCss: ".custom-card { border-radius: 8px; }",
        },
      },
    });

    const merged = mergeThemePalettes([pluginA, pluginB]);
    expect(merged.root).toEqual({
      "--font-sans": "Inter, sans-serif",
      primary: "#6366f1",
    });
    expect(merged.light).toEqual({
      "bg-color": "#ffffff",
      text: "#111827",
    });
    expect(merged.dark).toEqual({
      "bg-color": "#09090b",
      text: "#f4f4f5",
    });
    expect(merged.cssFiles).toEqual(["./styles/base.css", "./styles/override.css"]);
    expect(merged.customCss).toContain(".custom-card { border-radius: 8px; }");
  });

  it("generatePaletteCSS 生成规范的 CSS 内容与选择器", () => {
    const css = generatePaletteCSS({
      root: { "font-main": "system-ui", "--radius": "12px" },
      light: { primary: "#0066cc" },
      dark: { primary: "#66aaff" },
      cssFiles: ["@theme/extra.css"],
      customCss: "body { margin: 0; }",
    });

    expect(css).toContain('@import "@theme/extra.css";');
    expect(css).toContain(":root {");
    expect(css).toContain("  --font-main: system-ui;");
    expect(css).toContain("  --radius: 12px;");
    expect(css).toContain('[data-theme="light"]');
    expect(css).toContain("  --primary: #0066cc;");
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain("  --primary: #66aaff;");
    expect(css).toContain("body { margin: 0; }");
  });
});
