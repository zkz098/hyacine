import { describe, expect, it } from "vitest";
import {
  generateRuntimeModuleCode,
  generateSlotAstroComponent,
  injectAstroAST,
  matchesSelector,
} from "./index";

describe("plugin-astro generator", () => {
  it("生成空插槽组件", () => {
    const code = generateSlotAstroComponent("empty-slot", []);
    expect(code).toContain("empty-slot (empty)");
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
    expect(code).toContain('label="Hello"');
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

  it("无 Outlet 时自动通过 AST 注入虚拟插槽组件", async () => {
    const template = `---
const title = "My Post";
---
<div class="article-body">
  <p>Article body content</p>
</div>
`;
    const result = await injectAstroAST(template, "/src/pages/post.astro", {
      injectPoints: {
        "post-footer": { selector: ".article-body", position: "after", order: 0 },
      },
    });
    expect(result).not.toBeNull();
    expect(result!.code).toContain(
      'import HyacineSlot_PostFooter from "virtual:hyacine/slots/post-footer.astro"',
    );
    expect(result!.code).toContain("<HyacineSlot_PostFooter");
  });
});
