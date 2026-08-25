import type { HastPluginDefinition, MdastPluginDefinition } from "satteri";
import { SyntaxPluginSchema, type SyntaxPluginMeta } from "@hyacine/contract";

/** DOM 舞台上的组件渲染器：props → DOM 节点（预览端执行，须只依赖 DOM API） */
export type Props = Record<string, unknown>;
export type ComponentRenderer = (props: Props) => unknown;

/**
 * hyacine 语法插件（代码形态，跨 JSON 契约）：
 * - mdast/hast：satteri 官方插件协议（编译期把语法变成组件树）
 * - components：预览端自定义 JSX 标签 → DOM 渲染器（对齐博客组件输出结构）
 * - css：随插件注入的样式（自带作用域类名）
 */
export interface SyntaxPlugin extends SyntaxPluginMeta {
  mdast?: MdastPluginDefinition[];
  hast?: HastPluginDefinition[];
  components?: Record<string, ComponentRenderer>;
}

/** 内置 + 项目插件的注册表（项目插件通过 registerSyntaxPlugin 注册） */
const registry = new Map<string, SyntaxPlugin>();

export function registerSyntaxPlugin(plugin: SyntaxPlugin): void {
  const meta = SyntaxPluginSchema.parse(plugin);
  if (registry.has(meta.name) && registry.get(meta.name)?.builtin === true) {
    // 内置插件不可被项目同名覆盖（避免误覆盖官方语法）
    return;
  }
  registry.set(meta.name, { ...meta, ...plugin, name: meta.name });
}

export function getRegisteredPlugins(): SyntaxPlugin[] {
  return [...registry.values()];
}

/** 测试用：清空注册表 */
export function resetSyntaxRegistry(): void {
  registry.clear();
}

/** 默认启用列表（不回写，仅作为兜底） */
export const DEFAULT_ENABLED_PLUGINS = ["shokax-basic"] as const;
