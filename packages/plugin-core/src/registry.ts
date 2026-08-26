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
export function groupEntriesBySlot(manifests: PluginManifest[]): Map<string, InjectEntry[]> {
  const slotMap = new Map<string, InjectEntry[]>();

  for (const manifest of manifests) {
    for (const entry of manifest.entry) {
      const slot = entry.injectPoint ?? (entry.type === "custom-element" ? "layout" : undefined);
      if (!slot) continue;

      if (!slotMap.has(slot)) {
        slotMap.set(slot, []);
      }
      slotMap.get(slot)!.push(entry);
    }
  }

  // 对每个插槽内的 entries 进行排序 (order 升序)
  for (const [slot, entries] of slotMap.entries()) {
    slotMap.set(
      slot,
      entries.toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    );
  }

  return slotMap;
}

/**
 * 提取所有插件中包含的 runtime-only 入口（用于生成 virtual:hyacine/runtime）
 */
export function collectRuntimeEntries(manifests: PluginManifest[]): RuntimeOnlyEntry[] {
  const runtimes: RuntimeOnlyEntry[] = [];
  for (const manifest of manifests) {
    for (const entry of manifest.entry) {
      if (entry.type === "runtime-only") {
        runtimes.push(entry);
      }
    }
  }
  return runtimes.toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
