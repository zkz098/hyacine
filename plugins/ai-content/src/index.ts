import { definePlugin, type PluginManifest } from "@hyacine/plugin-core";

export interface AiSummaryPluginOptions {
  /** 是否启用 AI 摘要卡片，默认 true */
  enable?: boolean;
  /** 摘要卡片标题，默认 "AI 摘要" */
  title?: string;
  /** 是否显示摘要模型信息，默认 false */
  showModel?: boolean;
}

export interface AiRecommendPluginOptions {
  /** 是否启用 AI 相近文章推荐，默认 true */
  enable?: boolean;
  /** 最多展示推荐条数，默认 3 */
  limit?: number;
  /** 最低相似度阈值（0~1，或百分比数值 >1 自动归一），默认 0.4 */
  minSimilarity?: number;
  /** 推荐卡片标题，默认 "AI 推荐 · 相近文章" */
  title?: string;
}

export interface AiContentOptions {
  /** 总开关；为 true 时各子功能按自身开关生效（默认 false） */
  enable?: boolean;
  /** 网关地址；缺省回退环境变量 HYACINE_API_URL */
  apiUrl?: string;
  /** 只读令牌；缺省回退环境变量 HYACINE_READ_TOKEN（建议走环境变量，避免进入构建产物） */
  token?: string;
  aiSummary?: AiSummaryPluginOptions;
  aiRecommend?: AiRecommendPluginOptions;
}

/**
 * AI 内容插件：文章摘要卡片 + 相近文章推荐。
 *
 * 以 ssr 形式在构建期预计算（Pre-baked by Default）：
 * - `post-summary` 插槽：AI 摘要卡片
 * - `post-footer` 插槽：AI 相近文章推荐
 *
 * 两个组件都通过 astro:content 的 `hyacineArticle` 上下文读取文章
 * frontmatter（含云端注入的 ai 图谱/物化摘要），并在缺失时按需调用
 * Hyacine AI 网关（需页面通过 HyacineOutlet extraProps 传入 postId/postBody）。
 */
export function aiContent(options: AiContentOptions = {}): PluginManifest {
  const enable = options.enable === true;
  const apiUrl = options.apiUrl;
  const token = options.token;

  const summaryEnable = enable && options.aiSummary?.enable !== false;
  const recommendEnable = enable && options.aiRecommend?.enable !== false;

  return definePlugin({
    name: "@hyacine/plugin-ai-content",
    version: "0.1.0",
    minRenderCapability: "ssr",
    supportedPlatforms: ["astro"],
    entry: [
      {
        name: "ai-summary-ssr",
        type: "ssr",
        platform: "astro",
        injectPoint: "post-summary",
        requiresArticle: true,
        path: new URL("./AiSummaryCard.astro", import.meta.url).href,
        props: {
          enable: summaryEnable,
          title: options.aiSummary?.title,
          showModel: options.aiSummary?.showModel === true,
          apiUrl,
          token,
        },
      },
      {
        name: "ai-similar-ssr",
        type: "ssr",
        platform: "astro",
        injectPoint: "post-footer",
        requiresArticle: true,
        path: new URL("./AiSimilarPosts.astro", import.meta.url).href,
        props: {
          enable: recommendEnable,
          limit: options.aiRecommend?.limit ?? 3,
          minSimilarity: options.aiRecommend?.minSimilarity ?? 0.4,
          title: options.aiRecommend?.title,
          apiUrl,
          token,
        },
      },
    ],
  });
}

export default aiContent;
