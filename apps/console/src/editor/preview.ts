/**
 * ShokaX 一致性预览：用与 astro-blog-shokax **同一个** satteri 渲染管线
 * （同版本 satteri + 插件化 mdast/hast + feathers 配置）把 markdown/mdx
 * 渲染成与博客一致的 HTML 结构，再套上 ShokaX 的 CSS。
 *
 * - 纯 markdown（.md）→ markdownToHtml（快，直接输出 html 字符串）
 * - MDX（.mdx / 含组件或 ::: 指令）→ evaluate + 自定义 DOM jsx 运行时 +
 *   components 映射（组件结构逐一对齐各 .astro 组件输出）
 * - 代码块 → Shiki（github-light/dark 双主题 + colorized-brackets，同博客）包
 *   进 macOS 风格 code-window
 *
 * 语法插件化（P-a/P-b）：
 * - 内置扩展语法拆为 shokax-basic 插件（editor/syntax/shokax-basic.ts），默认启用
 * - 基础管线行为拆为 @hyacine/core（breaks/emoji/标题锚点），始终启用
 * - 用户可写项目插件（注册组件/CSS；mdast/hast 亦可，见 editor/syntax/types.ts）
 *
 * 依赖跨域隔离（COOP/COEP，见 vite.config + tauri.conf security.headers），
 * 因为 satteri 浏览器端是 WASI 构建、需要 SharedArrayBuffer。
 */
// oxlint-disable typescript/no-unsafe-type-assertion, typescript/no-base-to-string, eslint/no-underscore-dangle, eslint/no-unused-vars
import { appendChild, setProps, normalizeChildren } from "./syntax/dom";
import { coreSyntaxPlugin } from "./syntax/core";
import { shokaxBasicPlugin } from "./syntax/shokax-basic";
import type { ComponentRenderer, Props, SyntaxPlugin } from "./syntax/types";

/* ---------------- JSX runtime（构建 DOM） ---------------- */

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

/* ---------------- 插件组装 ---------------- */

export interface AssembledPreviewPlugins {
  mdast: NonNullable<SyntaxPlugin["mdast"]>;
  hast: NonNullable<SyntaxPlugin["hast"]>;
  components: Record<string, ComponentRenderer>;
  cssBlocks: string[];
}

/**
 * 把启用插件列表组装成渲染参数（按顺序合并；同名组件后加载覆盖）。
 * enabled：插件名数组（顺序即优先级，靠前优先）；userPlugins：项目用户插件。
 */
export function assemblePreviewPlugins(
  enabled: string[],
  userPlugins: SyntaxPlugin[] = [],
): AssembledPreviewPlugins {
  const byName = new Map<string, SyntaxPlugin>();
  for (const p of [coreSyntaxPlugin, shokaxBasicPlugin, ...userPlugins]) {
    byName.set(p.name, p);
  }
  const order = [
    ...new Set([coreSyntaxPlugin.name, ...enabled, ...userPlugins.map((p) => p.name)]),
  ];
  const mdast: NonNullable<SyntaxPlugin["mdast"]> = [];
  const hast: NonNullable<SyntaxPlugin["hast"]> = [];
  const components: Record<string, ComponentRenderer> = {};
  const cssBlocks: string[] = [];
  for (const name of order) {
    const plugin = byName.get(name);
    if (plugin === undefined) continue;
    if (plugin.mdast) mdast.push(...plugin.mdast);
    if (plugin.hast) hast.push(...plugin.hast);
    if (plugin.components) Object.assign(components, plugin.components);
    if (plugin.css) cssBlocks.push(plugin.css);
  }
  return { mdast, hast, components, cssBlocks };
}

/* ---------------- 渲染管线 ---------------- */

let satteriPromise: Promise<typeof import("satteri")> | null = null;
function loadSatteri(): Promise<typeof import("satteri")> {
  if (satteriPromise === null) satteriPromise = import("satteri");
  return satteriPromise;
}

const features = { gfm: true, math: true, directive: true };

/** 需要按 MDX 处理（evaluate）还是纯 markdown（markdownToHtml） */
export function needsMdxPipeline(source: string, isMdxFile: boolean): boolean {
  if (isMdxFile) return true;
  return (
    /(?:\n|^):::{1,3}\w+/.test(source) ||
    /\n<[A-Z][A-Za-z0-9]*\b|^<[A-Z][A-Za-z0-9]*\b/.test(source)
  );
}

export interface RenderPreviewOptions {
  /** 启用的插件名（决定 shokax-basic 等是否参与；缺省 = ["shokax-basic"]） */
  enabled?: string[];
  /** 项目用户插件（非 builtin） */
  plugins?: SyntaxPlugin[];
}

/**
 * 渲染 preview。返回一个含渲染内容的 div（含 shiki 高亮后的代码窗）。
 * 仅在浏览器可用（依赖 document）。
 */
export async function renderPreview(
  markdown: string,
  isMdxFile: boolean,
  options: RenderPreviewOptions = {},
): Promise<HTMLElement> {
  const satteri = await loadSatteri();
  const assembled = assemblePreviewPlugins(
    options.enabled ?? DEFAULT_ENABLED,
    options.plugins ?? [],
  );
  let root: Node;
  if (needsMdxPipeline(markdown, isMdxFile)) {
    const mod = await satteri.evaluate(markdown, {
      features,
      mdastPlugins: assembled.mdast,
      hastPlugins: assembled.hast,
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
    root = Content({ components: assembled.components }) as Node;
  } else {
    const result = await satteri.markdownToHtml(markdown, {
      features,
      mdastPlugins: assembled.mdast,
      hastPlugins: assembled.hast,
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

  // 注入插件 CSS（自带作用域类名；去重）
  const seen = new Set<string>();
  for (const css of assembled.cssBlocks) {
    if (seen.has(css) || css.length === 0) continue;
    seen.add(css);
    const style = document.createElement("style");
    style.setAttribute("data-syntax-plugin", "");
    style.textContent = css;
    wrapper.append(style);
  }

  await highlightCodeBlocks(wrapper);
  return wrapper;
}

const DEFAULT_ENABLED = ["shokax-basic"];

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
