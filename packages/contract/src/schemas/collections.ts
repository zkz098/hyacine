import { z } from "zod";

/**
 * 集合提取产物契约（hyacine.collections.json）：由 `hyc collections` 从博客
 * `src/content.config.ts` 运行时提取生成（降级可读 `.astro/collections/*.schema.json`），
 * 供三端共享：
 * - CLI/桌面：多集合登记（name→dir）、frontmatter 结构校验
 * - 管理台 Editor：schema 驱动的表单渲染（字段类型/enum/secret/image 提示）
 * - API：集合级过滤与 autogen 开关（后续）
 *
 * 注意：schema 是 zod 输入形状的 JSON Schema（draft 2020-12，与 Astro 的
 * `.astro/collections/*.schema.json` 同机制），transform/preprocess/refine 语义不保留。
 */

/** 字段 UI 类型（表单渲染器用） */
export const CollectionFieldKindSchema = z.enum([
  "string",
  "date",
  "boolean",
  "number",
  "enum",
  "string[]",
  "number[]",
  "object",
  "unknown",
]);

export type CollectionFieldKind = z.infer<typeof CollectionFieldKindSchema>;

export const CollectionFieldUiSchema = z.object({
  key: z.string().min(1),
  kind: CollectionFieldKindSchema,
  required: z.boolean(),
  hasDefault: z.boolean(),
  /** 敏感字段（password/token/secret…）：表单不回显、列表不预览 */
  secret: z.boolean().optional(),
  /** 图片字段（cover/thumbnail…）：表单渲染 asset picker */
  image: z.boolean().optional(),
  /** enum 可选值 */
  values: z.array(z.string()).optional(),
  description: z.string().optional(),
});

export type CollectionFieldUi = z.infer<typeof CollectionFieldUiSchema>;

export const CollectionContentKindSchema = z.enum(["content", "data", "unknown"]);

export type CollectionContentKind = z.infer<typeof CollectionContentKindSchema>;

export const CollectionSchema = z.object({
  /** 集合名（astro content.config.ts 的 collections key，如 posts/moments） */
  name: z.string().min(1).max(64),
  /** 集合目录（相对项目根，glob loader 的 base 或降级推导），如 src/posts */
  dir: z.string().min(1),
  /** glob pattern（非 glob loader 为 null） */
  pattern: z.string().nullable().default(null),
  /** 文件扩展名（从 pattern 推导，兜底 .md/.mdx） */
  extensions: z.array(z.string()).default([".md", ".mdx"]),
  contentKind: CollectionContentKindSchema,
  /** frontmatter 输入形状 JSON Schema（draft 2020-12） */
  schema: z.record(z.string(), z.unknown()),
  ui: z.object({
    fields: z.array(CollectionFieldUiSchema),
  }),
});

export type Collection = z.infer<typeof CollectionSchema>;

export const CollectionsFileSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  /** content.config.ts=运行时提取；astro-sync-fallback=读 Astro sync 产物降级 */
  source: z.enum(["content.config.ts", "astro-sync-fallback"]),
  collections: z.array(CollectionSchema),
  warnings: z.array(z.string()).default([]),
});

export type CollectionsFile = z.infer<typeof CollectionsFileSchema>;

/** 严格解析 hyacine.collections.json；不合法返回 null（调用方降级处理） */
export function parseCollectionsFile(parsed: unknown): CollectionsFile | null {
  const result = CollectionsFileSchema.safeParse(parsed);
  if (!result.success) return null;
  return result.data;
}
