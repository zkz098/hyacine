# @hyacine/plugin-analytics

Hyacine 官方插件：Google Analytics 4 与 Umami 网站统计。

- 渲染能力：`runtime-only`
- 注入方式：客户端 `DOMContentLoaded` 后动态注入 `<head>` 脚本（无需在主题中声明插槽）

## 使用

```ts
// hyacine.plugin.ts
import analytics from "@hyacine/plugin-analytics";

export default defineConfig({
  plugins: [
    analytics({
      googleAnalytics: {
        measurementId: "G-XXXXXXXXXX",
      },
      umami: {
        websiteId: "ceed9afc-...",
        scriptUrl: "https://cloud.umami.is/script.js",
      },
    }),
  ],
});
```

## 特性

- **GA4**：注入 gtag.js（async）+ dataLayer/gtag 引导脚本；首屏 `page_view` 在 `window load` 后上报，并监听 `astro:page-load` 兼容 Astro 客户端导航，按路径去重。
- **Umami**：注入 defer 脚本 + `data-website-id`；Umami 自身追踪 History API 变更，无需 SPA 适配。
- 任一配置未填写时，对应脚本不会注入。
