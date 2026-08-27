import { definePlugin, type PluginManifest } from "@hyacine/plugin-core";

export interface GoogleAnalyticsOptions {
  /** GA4 衡量 ID，例如 "G-XXXXXXXXXX"；留空则不注入 GA 脚本 */
  measurementId?: string;
}

export interface UmamiAnalyticsOptions {
  /** Umami 网站 ID；留空则不注入 Umami 脚本 */
  websiteId?: string;
  /** Umami 追踪脚本地址；默认使用官方云端脚本，自架实例时改为自有网域地址 */
  scriptUrl?: string;
}

export interface AnalyticsOptions {
  googleAnalytics?: GoogleAnalyticsOptions;
  umami?: UmamiAnalyticsOptions;
}

/**
 * 网站统计插件：GA4 + Umami。
 *
 * 以 runtime-only 形式在客户端 DOMContentLoaded 后动态注入 `<head>` 脚本：
 * - GA4：gtag.js（async）+ dataLayer/gtag 引导内联脚本，首发 page_view 在 window load
 *   后上报，并监听 `astro:page-load` 兼容客户端导航（按路径去重）。
 * - Umami：defer 脚本 + `data-website-id`，Umami 自身追踪 History API 变更。
 */
export function analytics(options: AnalyticsOptions = {}): PluginManifest {
  return definePlugin({
    name: "@hyacine/plugin-analytics",
    version: "0.1.0",
    minRenderCapability: "runtime-only",
    entry: [
      {
        name: "analytics-runtime",
        type: "runtime-only",
        injectPoint: "layout",
        path: new URL("./runtime.ts", import.meta.url).href,
        options: {
          googleAnalytics: options.googleAnalytics,
          umami: options.umami,
        },
      },
    ],
  });
}

export default analytics;
