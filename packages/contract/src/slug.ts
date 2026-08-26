import { pinyin } from "pinyin-pro";

/**
 * slug 生成策略（console 与 CLI 共用，避免两侧漂移）。
 *
 * 规则：
 * 1. 明写 slug 神圣：frontmatter 里已有 slug 时，只用 sanitize 清洗（保留中文/任意
 *    文字，仅合并空白、去非法 URL 字符、去首尾 -），**绝不二次 ASCII 化、绝不转拼音**。
 * 2. 纯 '-' 的退化值（早年 bug 生成的 `------`）视为缺失 → 重新生成。
 * 3. 自动生成：标题含中文 → 转拼音（无音调），否则原样；统一 lowercase、
 *    空白/下划线→'-'，仅保留 Unicode 字母数字与 '-'; 结果为空 → post-<时间戳>。
 */

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;
const ONLY_DASHES_RE = /-+$/;

/** 是否含 CJK（中文/日韩统一表意区） */
export function containsCjk(input: string): boolean {
  return CJK_RE.test(input);
}

/** 清洗"用户明写的 slug"：保留所有 Unicode 文字，不转拼音 */
export function sanitizeExplicitSlug(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-/, "")
    .replace(ONLY_DASHES_RE, "");
  // 全 '-'（或清洗后无有效字符）视为退化
  return slug.length === 0 ? "" : slug;
}

/**
 * 从标题自动生成 slug：
 * - 含中文 → 拼音（如 你好世界 → ni-hao-shi-jie）
 * - 否则按原文字符
 * - 兜底 post-<时间戳>
 */
export function autoSlug(title: string): string {
  let base = title.trim();
  if (containsCjk(base)) {
    base = pinyin(base, { toneType: "none", type: "array", nonZh: "consecutive" }).join("-");
  }
  const slug = base
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-/, "")
    .replace(ONLY_DASHES_RE, "");
  return slug.length > 0 ? slug : `post-${Date.now()}`;
}

/**
 * 展示/落盘用：显式 slug 优先（清洗保留中文）→ 退化/缺失时 autoSlug。
 */
export function displaySlug(dataSlug: unknown, title: string): string {
  if (typeof dataSlug === "string") {
    const s = sanitizeExplicitSlug(dataSlug);
    if (s.length > 0) return s;
  }
  return autoSlug(title);
}
