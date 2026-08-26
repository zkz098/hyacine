import type { ChunkOptions } from "../types";
import { stripMarkdown } from "./excerpt";

/**
 * 判断文章是否标记为加密文章（防止将私密内容送往 AI 端点）。
 */
export function isArticleEncrypted(
  contentOrFrontmatter: string | Record<string, unknown>,
): boolean {
  if (typeof contentOrFrontmatter === "object" && contentOrFrontmatter !== null) {
    if (contentOrFrontmatter.encrypted === true) return true;
    if (
      typeof contentOrFrontmatter.password === "string" &&
      contentOrFrontmatter.password.trim().length > 0
    ) {
      return true;
    }
    return false;
  }

  if (typeof contentOrFrontmatter === "string") {
    // 检查 Frontmatter 块中的 encrypted: true 或 password: "..."
    const match = contentOrFrontmatter.match(/^---[\s\S]*?---/);
    if (match) {
      const fm = match[0];
      if (/^\s*encrypted:\s*true\b/m.test(fm)) return true;
      if (/^\s*password:\s*["']?.+["']?/m.test(fm)) return true;
    }
  }

  return false;
}

/**
 * 结构感知切分文章为适合向量嵌入（Embedding）的文本块（Chunks）。
 * - 自动检测并跳过加密文章
 * - 剥离 Frontmatter
 * - 优先按 Markdown 标题（H1/H2/H3）切分小节，再按段落与长度切分
 */
export function chunkArticleForEmbedding(content: string, options: ChunkOptions = {}): string[] {
  if (isArticleEncrypted(content)) {
    return [];
  }

  const { maxChunkSize = 800, overlap = 100 } = options;

  // 1. 剥离 Frontmatter
  const cleanBody = content.replace(/^---[\s\S]*?---\s*/, "").trim();
  if (cleanBody.length === 0) {
    return [];
  }

  // 2. 按标题分段
  const sections = cleanBody.split(/(?=^#{1,4}\s+)/m);
  const chunks: string[] = [];

  for (const section of sections) {
    const cleanSection = stripMarkdown(section);
    if (cleanSection.length === 0) continue;

    if (cleanSection.length <= maxChunkSize) {
      chunks.push(cleanSection);
      continue;
    }

    // 3. 超长小节按段落切分
    const paragraphs = cleanSection.split(/\n\s*\n/);
    let currentChunk = "";

    for (const para of paragraphs) {
      const trimmedPara = para.trim();
      if (!trimmedPara) continue;

      if ((currentChunk + " " + trimmedPara).length <= maxChunkSize) {
        currentChunk = currentChunk ? `${currentChunk}\n\n${trimmedPara}` : trimmedPara;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }

        // 单个超长段落强制按字数步进切分
        if (trimmedPara.length > maxChunkSize) {
          let start = 0;
          while (start < trimmedPara.length) {
            const end = Math.min(start + maxChunkSize, trimmedPara.length);
            chunks.push(trimmedPara.slice(start, end));
            start += maxChunkSize - overlap;
            if (start >= trimmedPara.length - overlap) break;
          }
          currentChunk = "";
        } else {
          currentChunk = trimmedPara;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }
  }

  return chunks.filter((c) => c.trim().length > 0);
}
