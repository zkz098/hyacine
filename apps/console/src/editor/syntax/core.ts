import breaks from "../satteri-plugins/breaks";
import emoji from "../satteri-plugins/emoji";
import autolinkHeadings from "../satteri-plugins/autolink-headings";
import type { SyntaxPlugin } from "./types";

/**
 * 核心插件（不属 ShokaX 特有语法，而是「与博客渲染管线一致」的基础行为）：
 * GFM 换行(breaks)、emoji、标题锚点。features(gfm/math/directive) 由 satteri 编译期开启。
 * 默认始终启用，不属于可关闭的扩展。
 */
export const coreSyntaxPlugin: SyntaxPlugin = {
  name: "@hyacine/core",
  builtin: true,
  description: "基础 markdown 行为（breaks/emoji/标题锚点），与博客管线一致",
  mdast: [breaks(), emoji()],
  hast: [autolinkHeadings()],
};
