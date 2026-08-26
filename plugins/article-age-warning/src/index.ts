import { definePlugin, type PluginManifest } from "@hyacine/plugin-core";

export interface ArticleAgeWarningOptions {
  /** 超过多少天显示警告，默认为 180 天 */
  maxAgeDays?: number;
  /** 自定义警告文本 */
  message?: string;
  /** 从文章元数据中读取日期的字段名，默认为 "date" */
  dateField?: string;
  /** 挂载的插槽名称，默认为 "post-header" */
  injectPoint?: string;
}

export function articleAgeWarning(options: ArticleAgeWarningOptions = {}): PluginManifest {
  return definePlugin({
    name: "@hyacine/plugin-article-age-warning",
    version: "0.1.0",
    minRenderCapability: "ssr",
    supportedPlatforms: ["astro"],
    entry: [
      {
        name: "article-age-warning-ssr",
        type: "ssr",
        platform: "astro",
        injectPoint: options.injectPoint ?? "post-header",
        requiresArticle: true,
        path: new URL("./ArticleAgeWarning.astro", import.meta.url).href,
        props: {
          maxAgeDays: options.maxAgeDays ?? 180,
          message: options.message,
          dateField: options.dateField ?? "date",
        },
      },
    ],
  });
}

export default articleAgeWarning;
