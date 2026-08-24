import { createHash } from "node:crypto";
import matter from "gray-matter";

/** 任意内容 hash：sha256 hex 截断 16 位（contract 接受 8-128 hex） */
export function contentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex").slice(0, 16);
}

/**
 * 文章正文 hash：剥掉 frontmatter 只对正文计算。
 * 语义关键点：AI 产物（摘要/嵌入）只随正文失效——frontmatter 物化（写回
 * summary 四键）不得改变 hash，否则"物化→hash 变→又要 AI→再物化"死循环。
 */
export function postBodyHash(raw: string): string {
  const parsed = matter(raw);
  return contentHash(parsed.content);
}
