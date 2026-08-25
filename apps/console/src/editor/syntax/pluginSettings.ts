import { DEFAULT_ENABLED_PLUGINS, SyntaxPluginsSettingsSchema } from "@hyacine/contract";

/** 语法插件启用设置（本地预览设置，存储于 localStorage） */

const KEY = "hyacine.syntaxPlugins";

export function loadEnabledPlugins(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return [...DEFAULT_ENABLED_PLUGINS];
    const parsed = SyntaxPluginsSettingsSchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data.enabled : [...DEFAULT_ENABLED_PLUGINS];
  } catch {
    return [...DEFAULT_ENABLED_PLUGINS];
  }
}

export function saveEnabledPlugins(list: string[]): void {
  const parsed = SyntaxPluginsSettingsSchema.parse({ enabled: list });
  localStorage.setItem(KEY, JSON.stringify(parsed));
}

/** 切换某插件启用态，返回新列表并持久化 */
export function togglePluginEnabled(name: string, on: boolean): string[] {
  const current = loadEnabledPlugins();
  const next = on ? [...new Set([...current, name])] : current.filter((n) => n !== name);
  saveEnabledPlugins(next);
  return next;
}

/** 向页面广播插件设置变化（Editor 订阅以重建预览） */
export function notifyPluginsChanged(): void {
  window.dispatchEvent(new CustomEvent("hyacine:plugins-changed"));
}
