---
title: 插件系统与插槽集成
description: 了解如何在 Astro 博客中启用 Hyacine 插件系统，配置注入点与插槽组件。
---

Hyacine 提供了面向 Astro 现代博客生态的插件架构，具备**双模注入（一等公民声明式插槽 + 社区主题零侵入 AST 智能注入）**能力。无论你使用的是原生主题（如 `astro-blog-shokax`）还是任意社区开源 Astro 主题，都可以开箱即用地挂载插件。

---

## 1. 快速安装与配置

### 安装依赖

在你的 Astro 博客项目根目录安装核心包与 Astro 集成：

```bash
pnpm add @hyacine/plugin-core @hyacine/plugin-astro
```

### 配置 `astro.config.mjs`

在 Astro 配置文件中引入 `hyacinePlugin`：

```ts title="astro.config.mjs"
import { defineConfig } from "astro/config";
import { hyacinePlugin } from "@hyacine/plugin-astro";

export default defineConfig({
  integrations: [
    hyacinePlugin(), // 自动探测项目根目录下的 hyacine.plugin.ts
  ],
});
```

### 创建插件配置文件 `hyacine.plugin.ts`

在博客根目录创建 `hyacine.plugin.ts`：

```ts title="hyacine.plugin.ts"
import { defineConfig } from "@hyacine/plugin-core";
import siteUptime from "@hyacine/plugin-site-uptime";
import mouseFirework from "@hyacine/plugin-mouse-firework";
import articleAgeWarning from "@hyacine/plugin-article-age-warning";

export default defineConfig({
  // 声明注入点与选择器映射
  injectPoints: {
    // 简写：在匹配节点的闭标签前注入
    "footer-status": ".footer-status",

    // 高级定位：在 .post-body 节点之后插入
    "post-footer": {
      selector: ".post-body",
      position: "after",
      order: 10,
    },
  },
  plugins: [
    siteUptime({
      siteCreatedAt: "2024-01-01T00:00:00Z",
      prefixText: "本站已持续运行",
    }),
    mouseFirework({ count: 16, radius: 80 }),
    articleAgeWarning({ maxAgeDays: 180 }),
  ],
});
```

并在你的主布局文件（如 `Layout.astro`）中引入客户端 Runtime：

```astro title="src/layouts/Layout.astro"
---
// 全局布局
---
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <script>
      import "virtual:hyacine/runtime";
    </script>
  </head>
  <body>
    <slot />
  </body>
</html>
```

---

## 2. 双模注入机制 (`Dual-Track Injection`)

系统提供了两种互不冲突的插槽挂载模式：

```
                    ┌────────────────────────────┐
                    │      Astro 页面构建         │
                    └─────────────┬──────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
       【模式 A：显式声明插槽】          【模式 B：零侵入 AST 智能注入】
    主题显式放置 <HyacineOutlet />        未修改主题代码（任意第三方开源主题）
                  │                               │
                  ▼                               ▼
        100% 编译期类型推导               基于 injectPoints 选择器自动注入
                  │                               │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                    ┌────────────────────────────┐
                    │  Vite Virtual Module 聚合  │
                    └────────────────────────────┘
```

### 模式 A：原生主题使用 `<HyacineOutlet>`（一等公民）

在主题开发中，建议在布局与文章模板中直接使用 `<HyacineOutlet>` 声明插槽，获得最完美的类型推导与性能：

```astro title="src/layouts/PostLayout.astro"
---
import HyacineOutlet from "@hyacine/plugin-astro/components/HyacineOutlet.astro";
const { post } = Astro.props;
---
<article class="post-container">
  <h1>{post.data.title}</h1>

  {/* 文章头部插槽 */}
  <HyacineOutlet name="post-header" context={post} />

  <div class="post-content">
    <slot />
  </div>

  {/* 文章尾部插槽 */}
  <HyacineOutlet name="post-footer" context={post} />
</article>
```

### 模式 B：社区主题零侵入 AST 注入

如果你使用的是第三方社区主题，**不需要修改主题的任何代码**：

1. 打开 `hyacine.plugin.ts`；
2. 在 `injectPoints` 中为插槽指定主题中对应的 CSS 选择器（如 `.markdown-body` 或 `#footer`）；
3. 静态构建时，`@hyacine/plugin-astro` 的 AST 注入引擎会自动识别选择器并在目标位置精准挂载。

> **智能去重保障**：构建时若检测到页面中已经显式使用了 `<HyacineOutlet name="xyz" />`，AST 注入引擎会自动跳过该插槽的 AST 替换，杜绝重复渲染。

---

## 3. 四向精准锚定 (`InjectPosition`)

在配置 `injectPoints` 时，支持 4 种精准位置语义：

| 属性值          | 行为说明                                                 |
| :-------------- | :------------------------------------------------------- |
| `append` (默认) | 插入到目标节点的最后一个子节点之后（闭标签内部最下方）。 |
| `prepend`       | 插入到目标节点的第一个子节点之前（开标签内部最上方）。   |
| `before`        | 插入到目标节点外部的紧邻前方。                           |
| `after`         | 插入到目标节点外部的紧邻后方。                           |

```ts title="hyacine.plugin.ts"
export default defineConfig({
  injectPoints: {
    // 插入在评论框外部上方
    "post-footer": {
      selector: "#comments",
      position: "before",
    },
    // 插入在 sidebar 内部顶部
    "sidebar-top": {
      selector: ".sidebar-container",
      position: "prepend",
    },
  },
  plugins: [...],
});
```
