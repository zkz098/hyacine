import { definePlugin, type PluginManifest } from "@hyacine/plugin-core";

export interface SiteUptimeOptions {
  /** 建站日期（ISO 8601 字符串） */
  siteCreatedAt: string;
  /** 前缀文案，默认为 "本站已持续运行" */
  prefixText?: string;
}

export function siteUptime(options: SiteUptimeOptions): PluginManifest {
  const createdDate = new Date(options.siteCreatedAt);
  if (Number.isNaN(createdDate.getTime())) {
    throw new Error(`[site-uptime] Invalid date: "${options.siteCreatedAt}"`);
  }

  return definePlugin({
    name: "@hyacine/plugin-site-uptime",
    version: "0.1.0",
    minRenderCapability: "runtime-only",
    entry: [
      {
        name: "site-uptime-runtime",
        type: "runtime-only",
        injectPoint: "footer-status",
        path: new URL("./runtime.ts", import.meta.url).href,
        options: {
          siteCreatedAt: options.siteCreatedAt,
          prefixText: options.prefixText ?? "本站已持续运行",
        },
      },
    ],
  });
}

export default siteUptime;
