import { z } from "zod";
/**
 * 语法插件相关契约：
 * - 插件本体是代码（mdast 定义 / DOM 组件渲染函数），不经过 JSON 契约；
 *   契约只承载「描述性元数据」与「启用设置」。
 * - SyntaxPluginsSettingsSchema：跨端一致的启用列表存储（本地预览设置，默认启用 shokax-basic）。
 */
export declare const DEFAULT_ENABLED_PLUGINS: readonly ["shokax-basic"];
export declare const SyntaxPluginSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    builtin: z.ZodOptional<z.ZodBoolean>;
    css: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SyntaxPluginMeta = z.infer<typeof SyntaxPluginSchema>;
export declare const SyntaxPluginsSettingsSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type SyntaxPluginsSettings = z.infer<typeof SyntaxPluginsSettingsSchema>;
