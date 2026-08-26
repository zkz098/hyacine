import type { CardExcerptOptions } from "../types";

/**
 * 移除 Markdown 文本中的 Frontmatter、代码块、HTML 标签及特殊格式符号，返回纯净正文文本。
 */
export function stripMarkdown(content: string): string {
  if (!content || typeof content !== "string") {
    return "";
  }

  let text = content;

  // 1. 移除 Frontmatter
  text = text.replace(/^---[\s\S]*?---\s*/, "");

  // 2. 移除代码块 (```...``` 或 ~~~...~~~)
  text = text.replace(/```[\s\S]*?```/g, "");
  text = text.replace(/~~~[\s\S]*?~~~/g, "");

  // 3. 移除 Satteri / Shokax 自定义容器 (如 :::note ... ::: 或 :::spoiler ... :::)
  text = text.replace(/:::[a-zA-Z0-9_-]+[\s\S]*?:::/g, "");

  // 4. 移除 HTML 标签与注释
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<[^>]+>/g, "");

  // 5. 移除 Markdown 图片 ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "");

  // 6. 转换 Markdown 链接 [text](url) 为 text
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // 7. 移除标题标记 (#, ##, ...)
  text = text.replace(/^#{1,6}\s+/gm, "");

  // 8. 移除引用标记 (>) 与列表标记 (*, -, +, 1.)
  text = text.replace(/^>\s+/gm, "");
  text = text.replace(/^[\s*+-]\s+/gm, "");
  text = text.replace(/^\d+\.\s+/gm, "");

  // 9. 移除加粗/斜体/删除线/行内代码等符号 (*, _, ~, `, #)
  text = text.replace(/[#*_~`]/g, "");

  // 10. 规范化空白字符
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

export interface PostExcerptSource {
  body?: string;
  content?: string;
  description?: string;
  frontmatter?: Record<string, unknown>;
  ai?: {
    summary?: {
      summary?: string | null;
    } | null;
  } | null;
}

/**
 * 根据指定策略解析文章卡片摘要（优先 AI 摘要 / 描述 / 正文智能截断）。
 */
export function resolveCardExcerpt(
  post: PostExcerptSource,
  options: CardExcerptOptions = {},
): string {
  const { maxLength = 160, strategy = "auto", fallbackToBody = true } = options;

  const desc =
    post.description ??
    (typeof post.frontmatter?.description === "string" ? post.frontmatter.description : undefined);

  const aiSummary = post.ai?.summary?.summary?.trim();

  let selected = "";

  if (strategy === "ai") {
    if (aiSummary && aiSummary.length > 0) {
      selected = aiSummary;
    } else if (desc && desc.length > 0) {
      selected = desc;
    }
  } else if (strategy === "description") {
    if (desc && desc.length > 0) {
      selected = desc;
    } else if (aiSummary && aiSummary.length > 0) {
      selected = aiSummary;
    }
  } else {
    // 'auto' / 'default': 优先 description, 其次 aiSummary
    if (desc && desc.length > 0) {
      selected = desc;
    } else if (aiSummary && aiSummary.length > 0) {
      selected = aiSummary;
    }
  }

  // 若仍无可用摘要且允许回退到正文
  if (!selected && fallbackToBody) {
    const rawBody = post.body || post.content || "";
    selected = stripMarkdown(rawBody);
  }

  selected = selected.trim();

  if (selected.length > maxLength) {
    return `${selected.slice(0, maxLength).trim()}...`;
  }

  return selected;
}
