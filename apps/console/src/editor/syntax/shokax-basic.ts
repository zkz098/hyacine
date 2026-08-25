// oxlint-disable typescript/no-unsafe-type-assertion, typescript/no-base-to-string, eslint/no-underscore-dangle, eslint/no-unused-vars, typescript/restrict-template-expressions
import noteDirective from "../satteri-plugins/note-directive";
import codeGroup from "../satteri-plugins/code-group";
import spanDirective from "../satteri-plugins/span-directive";
import ins from "../satteri-plugins/ins";
import rubyDirective from "../satteri-plugins/ruby-directive";
import spoiler from "../satteri-plugins/spoiler";
import { appendChild, normalizeChildren, wrap } from "./dom";
import type { ComponentRenderer, Props, SyntaxPlugin } from "./types";

/**
 * shokax-basic 插件：ShokaX 扩展语法（渲染端零侵入的 L1/L2 能力）。
 * - mdast：::: 容器指令(Note/code-group/span/ruby/spoiler) + ++插入++(ins)
 * - components：Note/Label/Kbd/Highlight/Underline/Strike/Sub/Sup/Ruby/Text/Tabs/Collapse/Spoiler/Divider/Quiz*
 *   结构逐一对齐 astro-blog-shokax 各 .astro 组件输出。
 * 默认启用；可在「设置 → 语法插件」中关闭（关闭后上述指令/标签不再转换）。
 */

const NOTE_ICONS: Record<string, string> = {
  default: "i-ri-file-list-3-fill",
  primary: "i-ri-lightbulb-flash-fill",
  info: "i-ri-information-fill",
  success: "i-ri-checkbox-circle-fill",
  warning: "i-ri-alert-fill",
  danger: "i-ri-close-circle-fill",
};

const Note: ComponentRenderer = (p) => {
  const type = String(p.type ?? "primary");
  const title = p.title === undefined ? undefined : String(p.title);
  const icon = p.icon === undefined ? undefined : String(p.icon);
  const resolvedIcon = icon === "none" ? null : (icon ?? NOTE_ICONS[type]);
  const root = document.createElement("div");
  root.className = `note note-card ${type}`.trim();
  if (resolvedIcon) {
    const i = document.createElement("i");
    i.className = `note-icon ${resolvedIcon}`.trim();
    root.append(i);
  }
  const body = document.createElement("div");
  body.className = "note-body";
  if (title) {
    const t = document.createElement("div");
    t.className = "note-title";
    t.append(document.createTextNode(title));
    body.append(t);
  }
  const content = document.createElement("div");
  content.className = "note-content";
  for (const c of normalizeChildren(p)) appendChild(content, c);
  body.append(content);
  root.append(body);
  return root;
};

const Label: ComponentRenderer = (p: Props) =>
  wrap("span", `label ${p.type ?? "primary"}`.trim(), p);
const Kbd: ComponentRenderer = (p: Props) => wrap("kbd", "kbd", p);
const Highlight: ComponentRenderer = (p: Props) =>
  wrap("mark", `highlight ${p.type ?? "primary"}`.trim(), p);
const Underline: ComponentRenderer = (p: Props) => {
  const variant = p.variant === undefined || p.variant === "default" ? "" : String(p.variant);
  return wrap("ins", `underline ${p.type ?? "primary"} ${variant}`.trim(), p);
};
const Strike: ComponentRenderer = (p: Props) =>
  wrap("s", `strike ${p.type ?? "primary"}`.trim(), p);
const Sub: ComponentRenderer = (p: Props) => wrap("sub", "", p);
const Sup: ComponentRenderer = (p: Props) => wrap("sup", "", p);
const Ruby: ComponentRenderer = (p: Props) => {
  const rt = String(p.rt ?? "");
  const base = p.base === undefined ? null : String(p.base);
  const fallback = p.fallback !== false;
  const left = String(p.leftParen ?? "(");
  const right = String(p.rightParen ?? ")");
  return wrap(
    "ruby",
    "ruby-annotation",
    base === null ? p : { ...p, children: undefined },
    (node) => {
      if (base !== null) node.append(document.createTextNode(base));
      if (fallback) {
        const rp1 = document.createElement("rp");
        rp1.append(document.createTextNode(left));
        node.append(rp1);
      }
      const rtEl = document.createElement("rt");
      rtEl.append(document.createTextNode(rt));
      node.append(rtEl);
      if (fallback) {
        const rp2 = document.createElement("rp");
        rp2.append(document.createTextNode(right));
        node.append(rp2);
      }
    },
  );
};
const Text: ComponentRenderer = (p: Props) => wrap("span", `text ${p.type ?? "red"}`.trim(), p);
const Spoiler: ComponentRenderer = (p: Props) =>
  wrap("span", "spoiler", p, (node) => {
    if (p.title !== undefined) node.setAttribute("title", String(p.title));
  });
const Collapse: ComponentRenderer = (p: Props) => {
  const type = p.type === undefined || p.type === "default" ? "" : String(p.type);
  const title = p.title === undefined ? "折叠内容" : String(p.title);
  const details = document.createElement("details");
  details.className = `mdx-collapse ${type}`.trim();
  if (p.open === true) details.setAttribute("open", "");
  const summary = document.createElement("summary");
  summary.className = "mdx-collapse__summary";
  summary.append(document.createTextNode(title));
  details.append(summary);
  const content = document.createElement("div");
  content.className = "mdx-collapse__content";
  for (const c of normalizeChildren(p)) appendChild(content, c);
  details.append(content);
  return details;
};
const Tabs: ComponentRenderer = (p: Props) => wrap("div", "tabs", p);
const Tab: ComponentRenderer = (p: Props) => wrap("div", "tab", p);
const Divider: ComponentRenderer = () => {
  const hr = document.createElement("hr");
  hr.className = "divider";
  return hr;
};

/* Quiz 交互组件：预览按静态结构渲染（对齐 .astro 输出，交互由博客端 client 驱动） */
const Quiz: ComponentRenderer = (p: Props) =>
  wrap("div", `quiz-item ${p.type ?? "single"}`.trim(), p, (node) => {
    node.setAttribute("data-quiz-type", String(p.type ?? "single"));
  });
const QuizGroup: ComponentRenderer = (p: Props) => wrap("div", "quiz-group", p);
const QuizOptions: ComponentRenderer = (p: Props) => wrap("ul", "quiz-options", p);
const QuizOption: ComponentRenderer = (p: Props) =>
  wrap("li", "quiz-option", p, (node) => {
    if (p.correct === true) node.setAttribute("data-correct", "true");
  });
const QuizAnswer: ComponentRenderer = (p: Props) => wrap("div", "quiz-answer", p);
const QuizGap: ComponentRenderer = (p: Props) => {
  // 博客用 {answer}（children 被忽略），预览保持一致
  const span = document.createElement("span");
  span.className = "quiz-gap";
  span.setAttribute("aria-label", "填空题答案占位");
  const answer = p.answer === undefined ? "" : String(p.answer);
  if (answer.length > 0) span.setAttribute("data-answer", answer);
  span.append(document.createTextNode(answer));
  return span;
};
const QuizMistake: ComponentRenderer = (p: Props) =>
  wrap("div", "quiz-mistake", p, (node) => {
    const dt = p.dataType === undefined ? "错题备注" : String(p.dataType);
    node.setAttribute("data-type", dt);
  });

export const shokaxComponents: Record<string, ComponentRenderer> = {
  Note,
  Label,
  Kbd,
  Highlight,
  Underline,
  Strike,
  Sub,
  Sup,
  Ruby,
  Text,
  Spoiler,
  Collapse,
  Tabs,
  Tab,
  Divider,
  Quiz,
  QuizGroup,
  QuizOptions,
  QuizOption,
  QuizAnswer,
  QuizGap,
  QuizMistake,
};

export const shokaxBasicPlugin: SyntaxPlugin = {
  name: "shokax-basic",
  builtin: true,
  description: "ShokaX 扩展语法（Note 卡片/code-group/span/ruby/spoiler/++插入++/Quiz/Tabs 等）",
  mdast: [noteDirective(), codeGroup(), spanDirective(), rubyDirective(), spoiler(), ins()],
  components: shokaxComponents,
};
