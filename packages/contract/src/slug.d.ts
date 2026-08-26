/** 是否含 CJK（中文/日韩统一表意区） */
export declare function containsCjk(input: string): boolean;
/** 清洗"用户明写的 slug"：保留所有 Unicode 文字，不转拼音 */
export declare function sanitizeExplicitSlug(raw: string): string;
/**
 * 从标题自动生成 slug：
 * - 含中文 → 拼音（如 你好世界 → ni-hao-shi-jie）
 * - 否则按原文字符
 * - 兜底 post-<时间戳>
 */
export declare function autoSlug(title: string): string;
/**
 * 展示/落盘用：显式 slug 优先（清洗保留中文）→ 退化/缺失时 autoSlug。
 */
export declare function displaySlug(dataSlug: unknown, title: string): string;
