import { stripFrontmatter } from "./crypto";

/**
 * 服务端正文 hash：与 CLI postBodyHash 语义一致（剥离 frontmatter 后对正文
 * 做 sha256 截断 16 位）。一致性保证 hash diff / AI 产物关联在跨端正确。
 */
export async function postBodyHash(raw: string): Promise<string> {
  const body = stripFrontmatter(raw);
  const data = new TextEncoder().encode(body);
  const digest = await crypto.subtle.digest("SHA-256", data);
  let hex = "";
  for (const byte of new Uint8Array(digest)) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex.slice(0, 16);
}