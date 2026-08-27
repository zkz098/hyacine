import { definePlugin, type PluginManifest } from "@hyacine/plugin-core";
import type { ChartLabels, CountItem, MonthlyPostCount } from "./ArticleStatisticsCharts";

export type { ChartLabels, CountItem, MonthlyPostCount };

export interface ArticleStatisticsOptions {
  /** 是否启用文章统计图表，默认 true */
  enable?: boolean;
  /** 图表自定义文案 */
  chartLabels?: ChartLabels;
}

/**
 * 文章数据统计图表插件。
 *
 * 以 ssr 形式在 `article-statistics` 插槽渲染 ECharts 折线/柱状图表，并在客户端以 `client:load` 水合 Solid 组件。
 */
export function articleStatistics(options: ArticleStatisticsOptions = {}): PluginManifest {
  return definePlugin({
    name: "@hyacine/plugin-article-statistics",
    version: "0.1.0",
    minRenderCapability: "ssr",
    supportedPlatforms: ["astro"],
    entry: [
      {
        name: "article-statistics-ssr",
        type: "ssr",
        platform: "astro",
        injectPoint: "article-statistics",
        path: new URL("./ArticleStatisticsPlugin.astro", import.meta.url).href,
        props: {
          enable: options.enable !== false,
          chartLabels: options.chartLabels,
        },
      },
    ],
  });
}

export default articleStatistics;
