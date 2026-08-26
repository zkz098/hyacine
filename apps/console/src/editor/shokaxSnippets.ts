/**
 * ShokaX 常用语法骨架库。
 *
 * hyacine 是"管理台 + 原文 mdx"，ShokaX 语法是渲染端能力；这里只负责在
 * 光标处插入**正确的 markdown/mdx 原文骨架**，让作者不用手抄，最终由
 * astro-blog-shokax 负责渲染。块级骨架自带空行以免被 Milkdown commonmark
 * 并段。
 */

export interface ShokaxSnippet {
  id: string;
  label: string;
  icon: string;
  /** 生成插入到光标处的原文骨架 */
  build: () => string;
}

const P = "这里输入内容";

export const SHOKAX_SNIPPETS: ShokaxSnippet[] = [
  {
    id: "note-info",
    label: "提示卡",
    icon: "i-ri-information-line",
    build: () => `\n\n:::info\n${P}\n:::\n\n`,
  },
  {
    id: "note-warning",
    label: "警告卡",
    icon: "i-ri-alert-line",
    build: () => `\n\n:::warning\n${P}\n:::\n\n`,
  },
  {
    id: "note-danger",
    label: "危险卡",
    icon: "i-ri-error-warning-line",
    build: () => `\n\n:::danger\n${P}\n:::\n\n`,
  },
  {
    id: "code-group",
    label: "代码组",
    icon: "i-ri-code-s-slash-line",
    build: () =>
      `\n\n:::code-group\n\`\`\`js\n// JavaScript\n\n\`\`\`\n\n\`\`\`ts\n// TypeScript\n\n\`\`\`\n:::\n\n`,
  },
  {
    id: "tabs",
    label: "页签",
    icon: "i-ri-tab-line",
    build: () =>
      `\n\n<Tabs>\n  <Tab label="标签一">${P}</Tab>\n  <Tab label="标签二">${P}</Tab>\n</Tabs>\n\n`,
  },
  {
    id: "collapse",
    label: "折叠",
    icon: "i-ri-arrow-down-s-line",
    build: () => `\n\n<Collapse>\n  <summary>标题</summary>\n  ${P}\n</Collapse>\n\n`,
  },
  {
    id: "spoiler",
    label: "剧透",
    icon: "i-ri-eye-off-line",
    build: () => `<Spoiler>${P}</Spoiler>`,
  },
  {
    id: "highlight",
    label: "高亮",
    icon: "i-ri-mark-pen-line",
    build: () => `<Highlight>${P}</Highlight>`,
  },
  {
    id: "kbd",
    label: "键盘键",
    icon: "i-ri-keyboard-box-line",
    build: () => `<Kbd>Ctrl</Kbd>`,
  },
  {
    id: "underline",
    label: "下划线",
    icon: "i-ri-underline",
    build: () => `<Underline>${P}</Underline>`,
  },
  {
    id: "strike",
    label: "删除线",
    icon: "i-ri-strikethrough",
    build: () => `<Strike>${P}</Strike>`,
  },
  {
    id: "label",
    label: "标签",
    icon: "i-ri-price-tag-3-line",
    build: () => `<Label type="primary">${P}</Label>`,
  },
  {
    id: "ruby",
    label: "注音",
    icon: "i-ri-character-recognition-line",
    build: () => `<Ruby text="ふりがな">${P}</Ruby>`,
  },
];
