import { z } from "zod";

/**
 * 语法插件相关契约：
 * - 插件本体是代码（mdast 定义 / DOM 组件渲染函数），不经过 JSON 契约；
 *   契约只承载「描述性元数据」与「启用设置」。
 * - SyntaxPluginsSettingsSchema：跨端一致的启用列表存储（本地预览设置，默认启用 shokax-basic）。
 */

export const DEFAULT_ENABLED_PLUGINS = ["shokax-basic"] as const;

export const SyntaxPluginSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().max(512).optional(),
  /** 内置插件（随应用分发）；false/缺省 = 项目用户插件 */
  builtin: z.boolean().optional(),
  /** 注入 <style> 的 CSS（需自带作用域类，避免污染） */
  css: z.string().max(65_536).optional(),
});

export type SyntaxPluginMeta = z.infer<typeof SyntaxPluginSchema>;

export const SyntaxPluginsSettingsSchema = z.object({
  enabled: z.array(z.string().min(1).max(64)).default([...DEFAULT_ENABLED_PLUGINS]),
});

export type SyntaxPluginsSettings = z.infer<typeof SyntaxPluginsSettingsSchema>;
