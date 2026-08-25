export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    const codeA = a.charCodeAt(index);
    const codeB = b.charCodeAt(index);
    diff |= codeA ^ codeB;
  }
  return diff === 0;
}

/**
 * 剥离 frontmatter（供送 AI 使用）。
 * 只认文档开头是 `---\n`；结束行必须**精确等于** `---`（不允许 trim，
 * 避免正文/前言的缩进 `---` 或 hr 被误判为结束）。与 CLI 的 gray-matter
 * 语义保持一致：找到首个精确闭合围栏即停。
 */
export function stripFrontmatter(content: string): string {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
    return content;
  }
  const lines = content.split("\n");
  let endIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const stripped = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (stripped === "---") {
      endIndex = index;
      break;
    }
  }
  if (endIndex === -1) {
    return content;
  }
  return lines.slice(endIndex + 1).join("\n");
}

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const valueA = a[index] ?? 0;
    const valueB = b[index] ?? 0;
    dot += valueA * valueB;
    normA += valueA * valueA;
    normB += valueB * valueB;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// oxlint-disable unicorn/no-new-array

export function meanPool(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const first = vectors[0];
  if (first === undefined) return [];
  const dim = first.length;
  const result = new Array<number>(dim).fill(0);
  for (const vector of vectors) {
    for (let index = 0; index < dim; index += 1) {
      const current = result[index] ?? 0;
      const value = vector[index] ?? 0;
      result[index] = current + value;
    }
  }
  for (let index = 0; index < dim; index += 1) {
    const value = result[index] ?? 0;
    result[index] = value / vectors.length;
  }
  return result;
}
