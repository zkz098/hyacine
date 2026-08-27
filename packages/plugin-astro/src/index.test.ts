import { describe, expect, it } from "vitest";
import {
  createHyacineVitePlugin,
  generateRuntimeModuleCode,
  generateSlotAstroComponent,
  injectAstroAST,
  matchesSelector,
  RESOLVED_THEME_CSS_ID,
  VIRTUAL_THEME_CSS_ID,
} from "./index";

describe("plugin-astro generator", () => {
  it("生成空插槽组件", () => {
    const code = generateSlotAstroComponent("empty-slot", []);
    expect(code).toContain("empty-slot (empty)");
  });

  it("当仅有 runtime-only entries 时，依然生成包裹 DOM 容器", () => {
    const code = generateSlotAstroComponent("footer-status", [
      {
        name: "site-uptime-runtime",
        type: "runtime-only",
        path: "./runtime.ts",
        injectPoint: "footer-status",
        options: {},
      },
    ]);
    expect(code).toContain('class="hyacine-slot hyacine-slot-footer-status"');
    expect(code).toContain('data-hyacine-slot="footer-status"');
    expect(code).toContain("<slot />");
  });

  it("生成带水合指令的 SSR 插槽组件", () => {
    const code = generateSlotAstroComponent("post-footer", [
      {
        name: "test-widget",
        type: "ssr",
        path: "/path/to/Widget.astro",
        clientHydrationInstruction: "visible",
        props: { maxCount: 5, label: "Hello" },
      },
    ]);
    expect(code).toContain('import TestWidget0 from "/path/to/Widget.astro"');
    expect(code).toContain("client:visible");
    expect(code).toContain('label={"Hello"}');
    expect(code).toContain("maxCount={5}");
  });

  it("生成 Runtime 聚合初始化模块", () => {
    const code = generateRuntimeModuleCode([
      {
        name: "uptime",
        type: "runtime-only",
        path: "./uptime.ts",
        options: { start: "2024" },
      },
    ]);
    expect(code).toContain('import { init as initPlugin0 } from "./uptime.ts"');
    expect(code).toContain('initPlugin0({"start":"2024"})');
  });
});

describe("plugin-astro AST injector", () => {
  it("matchesSelector 正确匹配 tag, class, id", () => {
    const elementNode = {
      type: "element",
      name: "footer",
      attributes: [
        { name: "id", value: "site-footer" },
        { name: "class", value: "footer-container status-bar" },
      ],
    };
    expect(matchesSelector(elementNode, "footer")).toBe(true);
    expect(matchesSelector(elementNode, "#site-footer")).toBe(true);
    expect(matchesSelector(elementNode, ".status-bar")).toBe(true);
    expect(matchesSelector(elementNode, ".not-found")).toBe(false);
  });

  it("matchesSelector 正确匹配复合选择器与后代选择器", () => {
    const rootNode = {
      type: "element",
      name: "footer",
      attributes: [{ name: "id", value: "footer" }],
    };
    const childNode = {
      type: "element",
      name: "div",
      attributes: [{ name: "class", value: "status text-center" }],
    };
    expect(matchesSelector(childNode, "#footer .status", [rootNode])).toBe(true);
    expect(matchesSelector(childNode, "article.post .status", [rootNode])).toBe(false);

    const articleNode = {
      type: "element",
      name: "article",
      attributes: [{ name: "class", value: "post block" }],
    };
    const headerNode = {
      type: "element",
      name: "header",
      attributes: [],
    };
    expect(matchesSelector(articleNode, "article.post")).toBe(true);
    expect(matchesSelector(headerNode, "article.post header", [articleNode])).toBe(true);
  });

  it("在已有 <HyacineOutlet> 时跳过 AST 注入，避免双重渲染", async () => {
    const templateWithOutlet = `---
import HyacineOutlet from "./HyacineOutlet.astro";
---
<article class="post-content">
  <p>Hello world</p>
  <HyacineOutlet name="post-footer" />
</article>
`;
    const result = await injectAstroAST(templateWithOutlet, "/src/pages/post.astro", {
      injectPoints: {
        "post-footer": { selector: ".post-content", position: "append", order: 0 },
      },
    });
    // 应当跳过注入，返回 null
    expect(result).toBeNull();
  });

  it("无 Outlet 时自动通过 AST 注入虚拟插槽组件（支持后代选择器）", async () => {
    const template = `---
const title = "My Post";
---
<article class="post block">
  <header>
    <h1>Title</h1>
  </header>
  <div class="body md">
    <p>Article body content</p>
  </div>
</article>
`;
    const result = await injectAstroAST(template, "/src/pages/post.astro", {
      injectPoints: {
        "post-header": { selector: "article.post header", position: "after", order: 0 },
        "post-footer": { selector: "article.post .body", position: "after", order: 0 },
      },
    });
    expect(result).not.toBeNull();
    expect(result!.code).toContain(
      'import HyacineSlot_PostHeader from "virtual:hyacine/slots/post-header.astro"',
    );
    expect(result!.code).toContain(
      'import HyacineSlot_PostFooter from "virtual:hyacine/slots/post-footer.astro"',
    );
    expect(result!.code).toContain("<HyacineSlot_PostHeader");
    expect(result!.code).toContain("<HyacineSlot_PostFooter");
  });
});

describe("plugin-astro vite-plugin virtual theme.css", () => {
  it("正确解析并加载 virtual:hyacine/theme.css 虚拟样式", async () => {
    const plugin = createHyacineVitePlugin({
      config: {
        injectPoints: {},
        postCollection: "posts",
        plugins: [
          {
            name: "plugin-theme-custom",
            version: "1.0.0",
            minRenderCapability: "runtime-only",
            entry: [],
            theme: {
              palette: {
                root: { "--brand-color": "#4f46e5" },
                dark: { "bg-color": "#0f172a" },
                customCss: "a { text-decoration: none; }",
              },
            },
          },
        ],
      },
    });

    const resolveIdFn = plugin.resolveId as (id: string) => string | null;
    const loadFn = plugin.load as (id: string) => Promise<string | null> | string | null;

    const resolvedId = resolveIdFn.call({} as any, VIRTUAL_THEME_CSS_ID);
    expect(resolvedId).toBe(RESOLVED_THEME_CSS_ID);

    const cssContent = await loadFn.call({} as any, RESOLVED_THEME_CSS_ID);
    expect(cssContent).toContain("--brand-color: #4f46e5;");
    expect(cssContent).toContain('[data-theme="dark"]');
    expect(cssContent).toContain("--bg-color: #0f172a;");
    expect(cssContent).toContain("a { text-decoration: none; }");
  });
});
