/**
 * ShokaX 一致性预览：用与 astro-blog-shokax **同一个** satteri 渲染管线
 * （同版本 satteri + 同一批 mdast/hast 插件 + feathers 配置）把 markdown/mdx
 * 渲染成与博客一致的 HTML 结构，再套上 ShokaX 的 CSS。
 *
 * - 纯 markdown（.md）→ markdownToHtml（快，直接输出 html 字符串）
 * - MDX（.mdx / 含组件或 ::: 指令）→ evaluate + 自定义 DOM jsx 运行时 +
 *   components 映射（组件结构逐一对齐各 .astro 组件输出）
 * - 代码块 → Shiki（github-light/dark 双主题 + colorized-brackets，同博客）包
 *   进 macOS 风格 code-window
 *
 * 依赖跨域隔离（COOP/COEP，见 vite.config + tauri.conf security.headers），
 * 因为 satteri 浏览器端是 WASI 构建、需要 SharedArrayBuffer。
 */
import noteDirective from "./satteri-plugins/note-directive";
import codeGroup from "./satteri-plugins/code-group";
import spanDirective from "./satteri-plugins/span-directive";
import breaks from "./satteri-plugins/breaks";
import ins from "./satteri-plugins/ins";
import rubyDirective from "./satteri-plugins/ruby-directive";
import spoiler from "./satteri-plugins/spoiler";
import emoji from "./satteri-plugins/emoji";
import autolinkHeadings from "./satteri-plugins/autolink-headings";

type Props = Record<string, unknown>;
type ComponentRenderer = (props: Props) => unknown;

/* ---------------- JSX runtime（构建 DOM） ---------------- */

function flattenChildren(children: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const c of children) {
    if (Array.isArray(c)) out.push(...flattenChildren(c));
    else out.push(c);
  }
  return out;
}

function normalizeChildren(p: Props): unknown[] {
  const children = p.children;
  if (children === undefined || children === null) return [];
  return Array.isArray(children) ? flattenChildren(children) : [children];
}

function appendChild(parent: Node, child: unknown): void {
  if (child === null || child === undefined || child === false || child === true) return;
  if (typeof child === "string" || typeof child === "number") {
    parent.appendChild(document.createTextNode(String(child)));
  } else if (child instanceof Node) {
    parent.appendChild(child);
  }
}

function setProps(node: Element, p: Props): void {
  for (const [k, v] of Object.entries(p)) {
    if (k === "children" || k === "key") continue;
    if (v === null || v === undefined || v === false) continue;
    if (k === "className") node.setAttribute("class", String(v));
    else if (k === "dangerouslySetInnerHTML" && typeof v === "object" && v !== null) {
      node.innerHTML = String((v as { __html?: unknown }).__html ?? "");
    } else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (typeof v === "object") {
      node.setAttribute(k, JSON.stringify(v));
    } else {
      node.setAttribute(k, String(v));
    }
  }
}

/** evaluate 注入的 jsx/jsxs：类型 → DOM 节点 */
export function jsx(type: unknown, props: unknown): unknown {
  const p = (props ?? {}) as Props;
  const children = normalizeChildren(p);
  if (typeof type === "function") {
    // 组件 or Fragment：由组件渲染器自己消费 props（children 在 props 上）
    return (type as (pr: Props) => unknown)(p);
  }
  const tag = String(type);
  const node = document.createElement(tag);
  setProps(node, p);
  for (const c of children) appendChild(node, c);
  return node;
}
export const jsxs = jsx;
export const Fragment = (_p: Props = {}): DocumentFragment => {
  const f = document.createDocumentFragment();
  for (const c of normalizeChildren(_p)) appendChild(f, c);
  return f;
};

/* ---------------- ShokaX 组件 → DOM（对齐各 .astro 输出） ---------------- */

function wrap<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  p: Props,
  extra?: (node: HTMLElementTagNameMap[K]) => void,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className.length > 0) node.className = className;
  extra?.(node);
  for (const c of normalizeChildren(p)) appendChild(node, c);
  return node;
}

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
  const resolvedIcon = icon === "none" ? null : icon ?? NOTE_ICONS[type];
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

const Label: ComponentRenderer = (p) =>
  wrap("span", `label ${p.type ?? "primary"}`.trim(), p);
const Kbd: ComponentRenderer = (p) => wrap("kbd", "kbd", p);
const Highlight: ComponentRenderer = (p) =>
  wrap("mark", `highlight ${p.type ?? "primary"}`.trim(), p);
const Underline: ComponentRenderer = (p) => {
  const variant = p.variant === undefined || p.variant === "default" ? "" : String(p.variant);
  return wrap("ins", `underline ${p.type ?? "primary"} ${variant}`.trim(), p);
};
const Strike: ComponentRenderer = (p) => wrap("s", `strike ${p.type ?? "primary"}`.trim(), p);
const Sub: ComponentRenderer = (p) => wrap("sub", "", p);
const Sup: ComponentRenderer = (p) => wrap("sup", "", p);
const Ruby: ComponentRenderer = (p) => {
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
const Text: ComponentRenderer = (p) => wrap("span", `text ${p.type ?? "red"}`.trim(), p);
const Spoiler: ComponentRenderer = (p) =>
  wrap("span", "spoiler", p, (node) => {
    if (p.title !== undefined) node.setAttribute("title", String(p.title));
  });
const Collapse: ComponentRenderer = (p) => {
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
const Tabs: ComponentRenderer = (p) => wrap("div", "tabs", p);
const Tab: ComponentRenderer = (p) => wrap("div", "tab", p);
const Divider: ComponentRenderer = () => {
  const hr = document.createElement("hr");
  hr.className = "divider";
  return hr;
};

/* Quiz 交互组件：预览按静态结构渲染（对齐 .astro 输出，交互由博客端 client 驱动） */
const Quiz: ComponentRenderer = (p) =>
  wrap("div", `quiz-item ${p.type ?? "single"}`.trim(), p, (node) => {
    node.setAttribute("data-quiz-type", String(p.type ?? "single"));
  });
const QuizGroup: ComponentRenderer = (p) => wrap("div", "quiz-group", p);
const QuizOptions: ComponentRenderer = (p) => wrap("ul", "quiz-options", p);
const QuizOption: ComponentRenderer = (p) =>
  wrap("li", "quiz-option", p, (node) => {
    if (p.correct === true) node.setAttribute("data-correct", "true");
  });
const QuizAnswer: ComponentRenderer = (p) => wrap("div", "quiz-answer", p);
const QuizGap: ComponentRenderer = (p) => {
  // 博客用 {answer}（children 被忽略），预览保持一致
  const span = document.createElement("span");
  span.className = "quiz-gap";
  span.setAttribute("aria-label", "填空题答案占位");
  const answer = p.answer === undefined ? "" : String(p.answer);
  if (answer.length > 0) span.setAttribute("data-answer", answer);
  span.append(document.createTextNode(answer));
  return span;
};
const QuizMistake: ComponentRenderer = (p) =>
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

/* ---------------- 渲染管线 ---------------- */

let satteriPromise: Promise<typeof import("satteri")> | null = null;
function loadSatteri(): Promise<typeof import("satteri")> {
  if (satteriPromise === null) satteriPromise = import("satteri");
  return satteriPromise;
}

const features = { gfm: true, math: true, directive: true };

function mdastPlugins() {
  return [
    breaks(),
    ins(),
    emoji(),
    rubyDirective(),
    noteDirective(),
    spanDirective(),
    codeGroup(),
    spoiler(),
  ];
}

function hastPlugins() {
  return [autolinkHeadings()];
}

/** 需要按 MDX 处理（evaluate）还是纯 markdown（markdownToHtml） */
export function needsMdxPipeline(source: string, isMdxFile: boolean): boolean {
  if (isMdxFile) return true;
  return /(?:\n|^):::{1,3}\w+/.test(source) || /\n<[A-Z][A-Za-z0-9]*\b|^<[A-Z][A-Za-z0-9]*\b/.test(source);
}

/**
 * 渲染 preview。返回一个含渲染内容的 div（含 shiki 高亮后的代码窗）。
 * 仅在浏览器可用（依赖 document）。
 */
export async function renderPreview(markdown: string, isMdxFile: boolean): Promise<HTMLElement> {
  const satteri = await loadSatteri();
  const plugins = mdastPlugins();
  const hplugins = hastPlugins();

  let root: Node;
  if (needsMdxPipeline(markdown, isMdxFile)) {
    const mod = await satteri.evaluate(markdown, {
      features,
      mdastPlugins: plugins,
      hastPlugins: hplugins,
      jsx,
      jsxs,
      Fragment,
    });
    const Content = (mod as { default?: unknown }).default as
      | ((props: { components?: Record<string, ComponentRenderer> }) => unknown)
      | undefined;
    if (typeof Content !== "function") {
      throw new Error("satteri evaluate 未返回 MDXContent");
    }
    root = Content({ components: shokaxComponents }) as Node;
  } else {
    const result = await satteri.markdownToHtml(markdown, {
      features,
      mdastPlugins: plugins,
      hastPlugins: hplugins,
    });
    const tpl = document.createElement("template");
    tpl.innerHTML = result.html;
    root = tpl.content;
  }

  const wrapper = document.createElement("div");
  if (root instanceof Node) {
    wrapper.append(root);
  } else {
    wrapper.append(String(root));
  }
  await highlightCodeBlocks(wrapper);
  return wrapper;
}

/* ---------------- Shiki 代码高亮（同博客：双主题 + colorized-brackets） ---------------- */

async function highlightCodeBlocks(wrapper: HTMLElement): Promise<void> {
  // 测试环境跳过（vitest 注入 MODE=test，避免拉 shiki/oniguruma WASM）
  if ((import.meta as unknown as { env?: { MODE?: string } }).env?.MODE === "test") return;
  const codeBlocks = Array.from(wrapper.querySelectorAll("pre > code"));
  if (codeBlocks.length === 0) return;

  interface ShikiLike {
    codeToHtml: (src: string, opts: Record<string, unknown>) => Promise<string> | string;
  }
  let shikiApi: ShikiLike | null = null;
  try {
    const mod = await import("shiki");
    shikiApi = mod as unknown as ShikiLike;
  } catch {
    return; // shiki 不可用则保留 satteri 输出的朴素 <pre>
  }

  const colorizedBrackets = (await import("@shikijs/colorized-brackets"))
    .transformerColorizedBrackets;
  const transformerList = [colorizedBrackets()];

  for (const code of codeBlocks) {
    const pre = code.parentElement;
    if (pre === null) continue;
    const langClass = Array.from(code.classList).find((c) => c.startsWith("language-"));
    const lang = langClass === undefined ? "text" : langClass.slice("language-".length);
    // satteri 的 features.math 会把数学烘成 language-math 代码块；预览暂不
    // 高亮（katex 渲染后置），否则 shiki 报 "Language `math` is not included"。
    if (lang === "text" || lang === "math" || shikiApi === null) continue;
    const src = code.textContent ?? "";
    try {
      // 必须 await：codeToHtml 返回 Promise，漏 await 会拒绝成 unhandled rejection
      const html = await shikiApi.codeToHtml(src, {
        lang,
        themes: { light: "github-light", dark: "github-dark" },
        transformers: transformerList,
      });
      const win = document.createElement("div");
      win.className = "code-window";
      win.innerHTML =
        `<div class="code-window__head">` +
        `<span class="code-window__dots"><i></i><i></i><i></i></span>` +
        `<span class="code-window__lang">${lang}</span></div>` +
        `<div class="code-window__body">${html}</div>`;
      pre.replaceWith(win);
    } catch {
      // 高亮失败：保留原 pre
    }
  }
}

/** 生成默认的 Ruby/其他带参占位（供工具栏预览使用） */
export function sampleShokaxDoc(): string {
  return [
    ":::info",
    "提示卡片（Note）",
    ":::\n",
    "行内：<Highlight>高亮</Highlight> <Kbd>Ctrl</Kbd> <Underline>下划线</Underline> <Strike>删除线</Strike>\n",
    ":::code-group",
    "```js\nconst a = 1\n```",
    "```ts\nconst a: number = 1\n```",
    ":::\n",
  ].join("\n");
}