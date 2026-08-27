import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import type { HyacinePluginSystemConfig } from "@hyacine/plugin-core";
import { createJiti } from "jiti";
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
      "astro:config:setup": async ({ config, updateConfig, injectScript, logger }) => {
        let pluginConfig = options.config;

        if (!pluginConfig) {
          const rootDir = config.root ? fileURLToPath(config.root) : process.cwd();
          const configPath = join(rootDir, "hyacine.plugin.ts");

          if (existsSync(configPath)) {
            try {
              const jiti = createJiti(rootDir, { interopDefault: true });
              const mod = (await jiti.import(configPath)) as
                | { default?: HyacinePluginSystemConfig }
                | HyacinePluginSystemConfig;
              pluginConfig =
                mod && typeof mod === "object" && "default" in mod && mod.default
                  ? mod.default
                  : (mod as HyacinePluginSystemConfig);
              logger.info(`[hyacine] Loaded configuration from ${configPath}`);
            } catch (err) {
              logger.error(
                `[hyacine] Failed to load configuration from ${configPath}: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
              );
              pluginConfig = {
                injectPoints: {},
                plugins: [],
                postCollection: "posts",
              };
            }
          } else {
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

        // 自动注入主题样式 (SSR 构建期打包进静态 HTML Head)
        injectScript("page-ssr", 'import "virtual:hyacine/theme.css";');

        // 自动注入客户端 Runtime 初始化脚本
        injectScript("page", 'import "virtual:hyacine/runtime";');

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
