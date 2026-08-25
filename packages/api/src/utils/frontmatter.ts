import { stripFrontmatter } from "./crypto";

/**
 * 轻量 frontmatter 元数据解析（服务端远程导入用）：
 * 只提取 title/slug/draft/categories 四个键（博客 frontmatter 为简单 YAML 标量），
 * 不引入 YAML 依赖。解析失败/缺失时返回 undefined，由调用方派生兜底。
 */

export interface FrontmatterMeta {
  title?: string;
  slug?: string;
  draft?: boolean;
  categories?: string[];
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseCategories(value: string): string[] | undefined {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "[]") return [];
  if (trimmed.startsWith("[")) {
    return trimmed
      .slice(1, trimmed.endsWith("]") ? -1 : undefined)
      .split(",")
      .map(unquote)
      .filter((x) => x.length > 0);
  }
  const single = unquote(trimmed);
  return single.length > 0 ? [single] : undefined;
}

/** 解析 frontmatter 块（`---` 围栏内）为键值元数据 */
export function parseFrontmatterMeta(raw: string): FrontmatterMeta {
  if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) return {};
  const lines = raw.split("\n").slice(1);
  const front: Record<string, string> = {};
  let inFence = true;
  for (const line of lines) {
    const stripped = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (inFence && stripped === "---") break;
    inFence = false;
    const match = /^([A-Za-z][\w]*):\s*(.*)$/.exec(stripped);
    if (match !== null && match[1] !== undefined && match[2] !== undefined) {
      front[match[1].toLowerCase()] = match[2];
    }
  }

  const meta: FrontmatterMeta = {};
  const title = front["title"];
  if (title !== undefined && unquote(title).length > 0) meta.title = unquote(title);
  const slug = front["slug"];
  if (slug !== undefined && unquote(slug).length > 0) meta.slug = unquote(slug);
  const draftRaw = front["draft"];
  if (draftRaw !== undefined) {
    const t = draftRaw.trim().toLowerCase();
    if (t === "true" || t === "yes" || t === "1") meta.draft = true;
    else if (t === "false" || t === "no" || t === "0") meta.draft = false;
  }
  const categories = front["categories"];
  if (categories !== undefined) {
    const parsed = parseCategories(categories);
    if (parsed !== undefined) meta.categories = parsed;
  }
  return meta;
}

/** 供测试/复用：仅剥离 frontmatter 获取正文 */
export { stripFrontmatter };