import { definePlugin, type PluginManifest } from "@hyacine/plugin-core";

export interface WalineCommentsOptions {
  /** Waline 服务端地址，例如 https://comments.example.com */
  serverURL?: string;
  /** 评论语言；留空时由 Waline 根据浏览器语言决定 */
  lang?: string;
  /**
   * 暗黑模式配置：
   * - false: 关闭
   * - true: 强制开启
   * - "auto": 跟随系统
   * - CSS 选择器: 当选择器命中时启用暗黑模式
   */
  dark?: boolean | string;
  /** 评论路径；默认为当前 pathname（可用于多语言/去尾斜杠统一路径） */
  path?: string;
}

/**
 * Waline 评论插件。
 *
 * 以 ssr 形式在 `comment` 插槽渲染容器（带配置 data 属性），
 * 组件内 `<script>` 在客户端自举并调用 `@waline/client` 的 `init()`。
 * 主题在需要评论区的位置显式声明 `<HyacineOutlet name="comment" />`。
 */
export function walineComments(options: WalineCommentsOptions = {}): PluginManifest {
  return definePlugin({
    name: "@hyacine/plugin-waline-comments",
    version: "0.1.0",
    minRenderCapability: "ssr",
    supportedPlatforms: ["astro"],
    entry: [
      {
        name: "waline-comments-ssr",
        type: "ssr",
        platform: "astro",
        injectPoint: "comment",
        path: new URL("./WalineComments.astro", import.meta.url).href,
        props: {
          serverURL: options.serverURL,
          lang: options.lang,
          dark: options.dark,
          path: options.path,
        },
      },
    ],
  });
}

export default walineComments;
