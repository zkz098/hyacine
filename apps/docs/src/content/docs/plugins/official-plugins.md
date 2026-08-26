---
title: 官方核心插件库
description: 浏览 Hyacine 官方维护的核心插件列表、功能特性与使用示例。
---

Hyacine 官方提供了一组高频使用的开箱即用插件，覆盖站点状态、交互特效、文章时效性告警与流量统计。

---

## 1. 站点运行时长：`@hyacine/plugin-site-uptime`

- **类型**：`runtime-only`
- **默认插槽**：`footer-status`
- **功能**：根据建站日期实时计算并在页脚展示网站已持续运行的天、小时、分、秒。

### 使用示例

```ts title="hyacine.plugin.ts"
import siteUptime from "@hyacine/plugin-site-uptime";

export default defineConfig({
  injectPoints: {
    "footer-status": ".footer-status",
  },
  plugins: [
    siteUptime({
      siteCreatedAt: "2024-01-01T00:00:00Z",
      prefixText: "本站已持续运行",
    }),
  ],
});
```

---

## 2. 鼠标点击烟花：`@hyacine/plugin-mouse-firework`

- **类型**：`runtime-only`
- **默认插槽**：`layout`
- **功能**：在用户点击页面任意位置时生成炫酷的 Canvas 彩色粒子喷射特效。

### 使用示例

```ts title="hyacine.plugin.ts"
import mouseFirework from "@hyacine/plugin-mouse-firework";

export default defineConfig({
  plugins: [
    mouseFirework({
      count: 16, // 粒子数量
      radius: 80, // 扩散半径
      colors: ["#ff1744", "#d500f9", "#00e5ff", "#00e676", "#ffea00"],
    }),
  ],
});
```

---

## 3. 文章过时告警：`@hyacine/plugin-article-age-warning`

- **类型**：`ssr` (零客户端 JS)
- **默认插槽**：`post-header`
- **功能**：根据文章的 `date` 字段自动比对当前时间，若超过指定天数（默认 180 天）则在文章顶部静态渲染醒目的提示横幅。

### 使用示例

```ts title="hyacine.plugin.ts"
import articleAgeWarning from "@hyacine/plugin-article-age-warning";

export default defineConfig({
  injectPoints: {
    "post-header": ".post-header",
  },
  plugins: [
    articleAgeWarning({
      maxAgeDays: 180,
      message: "这篇文章发布较早，部分技术方案可能已更新，请谨慎参考。",
    }),
  ],
});
```

---

## 4. 页面/站点访问统计：`@hyacine/plugin-vercount`

- **类型**：`runtime-only`
- **默认插槽**：`layout`
- **功能**：轻量级集成 Vercount 访问计数器，自动统计 PV 与 UV。

### 使用示例

```ts title="hyacine.plugin.ts"
import vercount from "@hyacine/plugin-vercount";

export default defineConfig({
  plugins: [vercount()],
});
```
