import { readFileSync } from "node:fs";
import type { Plugin as VitePlugin } from "vite";
import {
  type HyacinePluginSystemConfig,
  collectRuntimeEntries,
  generatePaletteCSS,
  groupEntriesBySlot,
  mergeThemePalettes,
  normalizeInjectPoints,
} from "@hyacine/plugin-core";
import { generateRuntimeModuleCode, generateSlotAstroComponent } from "./generator";
import { injectAstroAST } from "./injector";

export const VIRTUAL_RUNTIME_ID = "virtual:hyacine/runtime";
export const RESOLVED_RUNTIME_ID = "\0virtual:hyacine/runtime";

export const VIRTUAL_CONFIG_ID = "virtual:hyacine/config";
export const RESOLVED_CONFIG_ID = "\0virtual:hyacine/config";

export const VIRTUAL_THEME_CSS_ID = "virtual:hyacine/theme.css";
export const RESOLVED_THEME_CSS_ID = "\0virtual:hyacine/theme.css";

export const VIRTUAL_SLOTS_MANIFEST_ID = "virtual:hyacine/slots-manifest";
export const RESOLVED_SLOTS_MANIFEST_ID = "\0virtual:hyacine/slots-manifest";

const VIRTUAL_SLOT_PREFIX = "virtual:hyacine/slots/";

export interface HyacineVitePluginOptions {
  config: HyacinePluginSystemConfig;
  enableAstInjection?: boolean;
}

export function createHyacineVitePlugin(options: HyacineVitePluginOptions): VitePlugin {
  const { config, enableAstInjection = true } = options;
  const manifests = config.plugins ?? [];
  const normalizedInjectPoints = normalizeInjectPoints(config.injectPoints);
  const groupedSlots = groupEntriesBySlot(manifests);

  // 收集所有已配置的插槽名以及标准插槽名
  const allSlotNames = Array.from(
    new Set([
      ...Object.keys(normalizedInjectPoints),
      ...groupedSlots.keys(),
      "head",
      "layout",
      "post-header",
      "post-footer",
      "footer-status",
      "sidebar",
      "comment",
    ]),
  );

  return {
    name: "vite-plugin-hyacine",
    enforce: "pre",

    resolveId(id: string) {
      if (id === VIRTUAL_RUNTIME_ID) {
        return RESOLVED_RUNTIME_ID;
      }
      if (id === VIRTUAL_CONFIG_ID) {
        return RESOLVED_CONFIG_ID;
      }
      if (id === VIRTUAL_THEME_CSS_ID) {
        return RESOLVED_THEME_CSS_ID;
      }
      if (id === VIRTUAL_SLOTS_MANIFEST_ID) {
        return RESOLVED_SLOTS_MANIFEST_ID;
      }
      if (id.startsWith(VIRTUAL_SLOT_PREFIX)) {
        // 虚拟 .astro 组件不能添加 \0 前缀，否则会被 @astrojs/vite-plugin-astro 忽略而无法编译为 Astro 组件
        return id;
      }
      return null;
    },

    async load(id: string) {
      if (id === RESOLVED_RUNTIME_ID) {
        const runtimes = collectRuntimeEntries(manifests);
        return generateRuntimeModuleCode(runtimes);
      }

      if (id === RESOLVED_CONFIG_ID) {
        return `export default ${JSON.stringify(config)};`;
      }

      if (id === RESOLVED_THEME_CSS_ID || id === VIRTUAL_THEME_CSS_ID) {
        const mergedPalette = mergeThemePalettes(manifests);
        return generatePaletteCSS(mergedPalette);
      }

      if (id === RESOLVED_SLOTS_MANIFEST_ID) {
        const imports: string[] = [];
        const entries: string[] = [];
        allSlotNames.forEach((slotName, i) => {
          const varName = `Slot_${i}`;
          imports.push(`import ${varName} from "virtual:hyacine/slots/${slotName}.astro";`);
          entries.push(`  ${JSON.stringify(slotName)}: ${varName},`);
        });

        return `// @ts-nocheck
${imports.join("\n")}

export const slots = {
${entries.join("\n")}
};

export default slots;
`;
      }

      if (id.startsWith(VIRTUAL_SLOT_PREFIX)) {
        let slotName = id.slice(VIRTUAL_SLOT_PREFIX.length);
        if (slotName.endsWith(".astro")) {
          slotName = slotName.slice(0, -".astro".length);
        }
        const entries = groupedSlots.get(slotName) ?? [];
        return generateSlotAstroComponent(slotName, entries);
      }

      // AST 智能注入：在 load 阶段拦截用户工程中的 .astro 源码，确保在 Astro 编译器 transform 之前完成模板注入
      if (
        enableAstInjection &&
        id.endsWith(".astro") &&
        !id.includes("node_modules") &&
        !id.startsWith("\0") &&
        !id.startsWith(VIRTUAL_SLOT_PREFIX)
      ) {
        try {
          const rawCode = readFileSync(id, "utf8");
          const injected = await injectAstroAST(rawCode, id, {
            injectPoints: normalizedInjectPoints,
          });
          if (injected) {
            return injected.code;
          }
        } catch {
          // fall through to default loader
        }
      }

      return null;
    },
  };
}
