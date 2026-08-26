# @hyacine/plugin-astro

面向 Astro 博客生态的 Hyacine 插件集成：支持双模注入（一等公民声明式插槽 + 零侵入 AST 注入）与 Vite 虚拟模块分发。

## 安装

```bash
pnpm add @hyacine/plugin-astro @hyacine/plugin-core
```

## 快速接入

### 1. 配置 `astro.config.mjs`

```ts
import { defineConfig } from "astro/config";
import { hyacinePlugin } from "@hyacine/plugin-astro";

export default defineConfig({
  integrations: [hyacinePlugin()],
});
```

### 2. 创建 `hyacine.plugin.ts`

```ts
import { defineConfig } from "@hyacine/plugin-core";
import siteUptime from "@hyacine/plugin-site-uptime";
import articleAgeWarning from "@hyacine/plugin-article-age-warning";

export default defineConfig({
  injectPoints: {
    "footer-status": ".footer-status",
    "post-footer": { selector: ".post-content", position: "after" },
  },
  plugins: [
    siteUptime({ siteCreatedAt: "2024-01-01T00:00:00Z" }),
    articleAgeWarning({ maxAgeDays: 180 }),
  ],
});
```

### 3. 主题中使用一等公民插槽（可选）

```astro
---
import HyacineOutlet from "@hyacine/plugin-astro/components/HyacineOutlet.astro";
const { post } = Astro.props;
---
<article>
  <HyacineOutlet name="post-header" context={post} />
  <slot />
  <HyacineOutlet name="post-footer" context={post} />
</article>
```
