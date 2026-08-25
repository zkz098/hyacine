// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderPreview, needsMdxPipeline } from "./preview";

describe("satteri 一致性命中（evaluate + 组件映射）", () => {
  it(":::info 容器指令 → div.note.note-card.info 结构", async () => {
    const out = await renderPreview(":::info\n提示内容\n:::", false);
    const note = out.querySelector(".note.note-card.info");
    expect(note).not.toBeNull();
    expect(note!.querySelector(".note-content")?.textContent).toContain("提示内容");
  });

  it("直接量 <Note type=warning title> → 复刻 .astro 输出结构", async () => {
    const out = await renderPreview('<Note type="warning" title="注意">\n小心\n</Note>', true);
    const note = out.querySelector(".note.note-card.warning");
    expect(note).not.toBeNull();
    expect(note!.querySelector(".note-title")?.textContent).toBe("注意");
    expect(note!.querySelector(".note-content")?.textContent).toContain("小心");
    expect(note!.querySelector(".note-icon")?.className).toContain("i-ri-alert-fill");
  });

  it("内联组件 Kbd/Highlight/Underline/Strike 输出对齐 .astro", async () => {
    const out = await renderPreview(
      "<p><Kbd>Ctrl</Kbd> <Highlight>高</Highlight> <Underline>下</Underline> <Strike>删</Strike></p>",
      true,
    );
    expect(out.querySelector("kbd.kbd")?.textContent).toBe("Ctrl");
    expect(out.querySelector("mark.highlight.primary")).not.toBeNull();
    expect(out.querySelector("ins.underline.primary")).not.toBeNull();
    expect(out.querySelector("s.strike.primary")).not.toBeNull();
  });

  it("fenced code 输出 pre>code.language-*（无 shiki 时保留朴素结构）", async () => {
    const out = await renderPreview("```ts\nconst a: number = 1\n```", false);
    const code = out.querySelector("pre > code.language-ts");
    expect(code).not.toBeNull();
    expect(code?.textContent).toContain("const a");
  });

  it("frontmatter 被剥离", async () => {
    const out = await renderPreview("---\ntitle: T\n---\n正文", false);
    expect(out.textContent).not.toContain("title: T");
    expect(out.textContent).toContain("正文");
  });

  it("needsMdxPipeline 判定", () => {
    expect(needsMdxPipeline(":::info\nx", false)).toBe(true);
    expect(needsMdxPipeline("<Note>hi</Note>", false)).toBe(true);
    expect(needsMdxPipeline("# plain\nhello", false)).toBe(false);
    expect(needsMdxPipeline("plain", true)).toBe(true);
  });
});