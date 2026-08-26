import { z } from "zod";
import { SlugSchema } from "./common";
import { FrontmatterSchema } from "./post";

/**
 * 插件渲染能力分级：
 * - runtime-only: 仅客户端运行时初始化（无 SSR 依赖）
 * - custom-element: 基于 Web Components 的通用注入
 * - ssr: 服务端/构建时静态渲染（支持 Astro 水合指令）
 */
export const RenderCapabilitySchema = z.enum(["runtime-only", "custom-element", "ssr"]);
export type RenderCapability = z.infer<typeof RenderCapabilitySchema>;

/** 插件支持的平台 */
export const PluginPlatformTypeSchema = z.enum(["astro", "universal"]);
export type PluginPlatformType = z.infer<typeof PluginPlatformTypeSchema>;

/** AST 注入方位策略 */
export const InjectPositionSchema = z.enum(["before", "after", "prepend", "append"]);
export type InjectPosition = z.infer<typeof InjectPositionSchema>;

/** Astro 客户端水合指令 */
export const HydrationInstructionSchema = z.enum(["load", "idle", "visible", "media"]);
export type HydrationInstruction = z.infer<typeof HydrationInstructionSchema>;

/** 注入点高级配置 */
export const InjectPointDetailSchema = z.object({
  selector: z.string().min(1),
  position: InjectPositionSchema.default("append"),
  order: z.number().int().default(0),
});
export type InjectPointDetail = z.infer<typeof InjectPointDetailSchema>;

/** 注入点值：支持简写字符串（如 ".footer-status"）或高级对象配置 */
export const InjectPointValueSchema = z.union([z.string().min(1), InjectPointDetailSchema]);
export type InjectPointValue = z.infer<typeof InjectPointValueSchema>;

/** 注入点映射表 */
export const InjectPointsConfigSchema = z.record(z.string(), InjectPointValueSchema);
export type InjectPointsConfig = z.infer<typeof InjectPointsConfigSchema>;

/** 标准插槽预设名称 */
export const StandardSlotNameSchema = z.enum([
  "head",
  "layout",
  "post-header",
  "post-meta",
  "post-footer",
  "sidebar",
  "footer",
  "footer-status",
  "comment",
  "widgets",
  "toolbar",
]);
export type StandardSlotName = z.infer<typeof StandardSlotNameSchema>;

/** 基础注入入口 */
export const BaseInjectEntrySchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  injectPoint: z.string().min(1).optional(),
  order: z.number().int().optional(),
});

/** Runtime-only 插件入口 */
export const RuntimeOnlyEntrySchema = BaseInjectEntrySchema.extend({
  type: z.literal("runtime-only"),
  options: z.record(z.string(), z.unknown()).optional(),
});
export type RuntimeOnlyEntry = z.infer<typeof RuntimeOnlyEntrySchema>;

/** Custom Element 插件入口 */
export const CustomElementEntrySchema = BaseInjectEntrySchema.extend({
  type: z.literal("custom-element"),
  injectPoint: z.string().default("layout"),
});
export type CustomElementEntry = z.infer<typeof CustomElementEntrySchema>;

/** SSR 插件入口 */
export const SSREntrySchema = BaseInjectEntrySchema.extend({
  type: z.literal("ssr"),
  platform: PluginPlatformTypeSchema.optional(),
  requiresArticle: z.boolean().optional(),
  clientHydrationInstruction: HydrationInstructionSchema.optional(),
  props: z.record(z.string(), z.unknown()).optional(),
});
export type SSREntry = z.infer<typeof SSREntrySchema>;

export const InjectEntrySchema = z.union([
  RuntimeOnlyEntrySchema,
  CustomElementEntrySchema,
  SSREntrySchema,
]);
export type InjectEntry = z.infer<typeof InjectEntrySchema>;

/** 插件 Manifest */
export const PluginManifestSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  minRenderCapability: RenderCapabilitySchema,
  supportedPlatforms: z.array(PluginPlatformTypeSchema).optional(),
  compatibleAPIPattern: z.string().optional(),
  entry: z.array(InjectEntrySchema),
});
export type PluginManifest = z.infer<typeof PluginManifestSchema>;

/** 插件系统主配置 */
export const HyacinePluginSystemConfigSchema = z.object({
  injectPoints: InjectPointsConfigSchema.default({}),
  postCollection: z.string().optional().default("posts"),
  plugins: z.array(PluginManifestSchema).default([]),
});
export type HyacinePluginSystemConfig = z.infer<typeof HyacinePluginSystemConfigSchema>;
export type HyacinePluginConfigInput = z.input<typeof HyacinePluginSystemConfigSchema>;

/** 传递给 SSR 插件的文章上下文 (强类型) */
export const HyacineArticleContextSchema = z
  .object({
    id: z.string().optional(),
    slug: SlugSchema.optional(),
    data: FrontmatterSchema.optional(),
    body: z.string().optional(),
    collection: z.string().optional(),
  })
  .passthrough();
export type HyacineArticleContext = z.infer<typeof HyacineArticleContextSchema>;
