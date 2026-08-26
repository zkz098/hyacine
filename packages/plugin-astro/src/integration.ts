import type { AstroIntegration } from "astro";
import type { HyacinePluginSystemConfig } from "@hyacine/plugin-core";
import { createHyacineVitePlugin } from "./vite-plugin";

export interface HyacinePluginIntegrationOptions {
  /** 插件系统配置，如果不传则自动尝试从当前根目录加载 hyacine.plugin.ts */
  config?: HyacinePluginSystemConfig;
  /** 是否启用零侵入 AST 智能注入（默认为 true） */
  enableAstInjection?: boolean;
}

export function hyacinePlugin(options: HyacinePluginIntegrationOptions = {}): AstroIntegration {
  return {
    name: "@hyacine/plugin-astro",
    hooks: {
      "astro:config:setup": async ({ config, updateConfig, logger }) => {
        let pluginConfig = options.config;

        if (!pluginConfig) {
          try {
            const configUrl = new URL("./hyacine.plugin.ts", config.root);
            const mod = await import(configUrl.href);
            pluginConfig = mod.default;
            logger.info(`[hyacine] Loaded configuration from ${configUrl.pathname}`);
          } catch {
            pluginConfig = {
              injectPoints: {},
              plugins: [],
              postCollection: "posts",
            };
          }
        }

        const finalConfig: HyacinePluginSystemConfig = pluginConfig ?? {
          injectPoints: {},
          plugins: [],
          postCollection: "posts",
        };

        updateConfig({
          vite: {
            plugins: [
              createHyacineVitePlugin({
                config: finalConfig,
                enableAstInjection: options.enableAstInjection ?? true,
              }),
            ],
          },
        });
      },
    },
  };
}

export default hyacinePlugin;
