import type { InjectEntry, PluginManifest, RuntimeOnlyEntry, SSREntry } from "@hyacine/contract";
export interface SlotResolvedEntries {
    slotName: string;
    entries: InjectEntry[];
    ssrEntries: SSREntry[];
    runtimeEntries: RuntimeOnlyEntry[];
}
/**
 * 将所有插件中的 Entry 按照 slot (injectPoint) 分组并按 order 排序
 */
export declare function groupEntriesBySlot(manifests: PluginManifest[]): Map<string, InjectEntry[]>;
/**
 * 提取所有插件中包含的 runtime-only 入口（用于生成 virtual:hyacine/runtime）
 */
export declare function collectRuntimeEntries(manifests: PluginManifest[]): RuntimeOnlyEntry[];
