// oxlint-disable typescript/no-unsafe-type-assertion
import { describe, expect, it } from "vitest";
import { assemblePreviewPlugins } from "../preview";
import type { SyntaxPlugin, ComponentRenderer } from "./types";

const fakeMdast = { type: "fakeMdast" } as unknown as NonNullable<SyntaxPlugin["mdast"]>;
const fakeHast = { type: "fakeHast" } as unknown as NonNullable<SyntaxPlugin["hast"]>;

function renderer(name: string): ComponentRenderer {
  return () => name;
}

describe("assemblePreviewPlugins", () => {
  it("默认（shokax-basic 启用）包含 core 与 shokax-basic 组件", () => {
    const a = assemblePreviewPlugins(["shokax-basic"]);
    expect(a.components.Note).toBeTypeOf("function");
    expect(a.components.Quiz).toBeTypeOf("function");
    expect(a.mdast.length).toBeGreaterThan(0);
    expect(a.hast.length).toBeGreaterThan(0);
  });

  it("禁用 shokax-basic 后其组件/语法不再参与（core 仍在）", () => {
    const a = assemblePreviewPlugins([]);
    expect(a.components.Note).toBeUndefined();
    expect(a.components.Quiz).toBeUndefined();
    // core 始终注入
    expect(a.mdast.length).toBeGreaterThan(0);
    expect(a.hast.length).toBeGreaterThan(0);
  });

  it("项目插件按顺序合并且同名组件后覆盖", () => {
    const user: SyntaxPlugin[] = [
      { name: "myx", components: { MyX: renderer("myx") }, css: ".myx{}" },
      { name: "myx2", components: { MyX: renderer("myx2") } },
    ];
    const a = assemblePreviewPlugins(["shokax-basic", "myx", "myx2"], user);
    // myx2 靠后 → 覆盖 MyX
    expect((a.components.MyX as ComponentRenderer)({})).toBe("myx2");
    expect(a.cssBlocks).toContain(".myx{}");
  });

  it("用户插件可引入 mdast/hast", () => {
    const user: SyntaxPlugin[] = [
      { name: "ext", mdast: [fakeMdast as never], hast: [fakeHast as never] },
    ];
    const a = assemblePreviewPlugins(["shokax-basic", "ext"], user);
    expect(a.mdast).toContain(fakeMdast);
    expect(a.hast).toContain(fakeHast);
  });
});
