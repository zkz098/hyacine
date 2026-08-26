# SPEC-PLUGINS：Hyacine 现代化插件系统架构与规范

> 契约唯一真相：`packages/contract/src/schemas/plugin.ts`。  
> 核心实现：`packages/plugin-core`（配置/注册表）、`packages/plugin-astro`（Astro 集成/双模注入引擎）、`plugins/*`（官方核心插件）。

---

## 1. 目标与设计原则

### 1.1 核心目标

构建面向 Astro 现代博客生态的插件系统，达成以下两个关键目标：

1. **零侵入兼容任意社区主题**：对于第三方现存主题（如 Fuwari, Cactus, Starlight 等），无需修改主题源码，通过 CSS 选择器即可在构建期由 AST 注入引擎自动挂载；
2. **原生主题一等公民体验**：对于 Hyacine 原生主题（如 `astro-blog-shokax`），提供强类型声明式插槽 `<HyacineOutlet name="..." context={post} />`，获得完美的编译期类型推导与稳定性。

### 1.2 硬约束与核心原则

- **双模并存与智能去重 (`Dual-Track Injection`)**：
  - 若模板中显式包含 `<HyacineOutlet name="slotName">`，AST 注入引擎**自动跳过**该插槽的 AST 替换，杜绝重复渲染；
  - 若模板未包含 Outlet，AST 注入引擎自动扫描 `injectPoints` 中配置的选择器并安全挂载。
- **分层渲染能力模型 (`minRenderCapability`)**：
  - `runtime-only`：仅客户端执行，无 SSR 依赖（例如鼠标烟花、建站时长、统计脚本）；
  - `custom-element`：基于 Web Components 的跨框架通用组件；
  - `ssr`：服务端/静态构建期 Astro 组件渲染，支持 `client:load` / `client:visible` / `client:idle` / `client:media` 水合指令。
- **Vite 虚拟模块收敛 (`Virtual Module Hub`)**：
  - AST 注入器仅向源码插入统一的虚拟组件标签，所有复杂的插槽聚合、Props 穿透与水合指令均由 `virtual:hyacine/*` 虚拟模块在下层统一调度。
- **构建时预计算先行 (`Pre-baked by Default`)**：
  - 尽可能在 SSG 构建期消化计算（如文章过时判定、AI 衍生数据），输出 100% 纯静态 HTML，保持零客户端冷启动开销。

---

## 2. 架构与包结构

```
hyacine/
├── packages/
│   ├── contract/          # Zod 契约模式 (PluginManifestSchema, InjectPointsConfigSchema 等)
│   ├── plugin-core/       # 插件核心库 (defineConfig, definePlugin, 归一化与注册表排序)
│   ├── plugin-astro/      # Astro 集成 (hyacinePlugin 集成, <HyacineOutlet>, AST 注入器, Vite 虚拟模块)
│   ├── sdk/               # 前台 SDK (hyacineLoader 与数据流水线)
│   ├── api/               # Cloudflare Workers API
│   └── cli/               # hyc 命令行工具
└── plugins/               # 官方核心插件集
    ├── site-uptime/       # 建站时长统计 (runtime-only)
    ├── mouse-firework/    # 鼠标点击烟花特效 (runtime-only)
    ├── article-age-warning/ # 文章过时告警 (ssr 零 JS 静态渲染)
    └── vercount/          # 访问量统计 (runtime-only)
```

---

## 3. 契约规范 (`@hyacine/contract`)

### 3.1 渲染能力与注入点定义

```ts
export type RenderCapability = "runtime-only" | "custom-element" | "ssr";
export type InjectPosition = "before" | "after" | "prepend" | "append";
export type HydrationInstruction = "load" | "idle" | "visible" | "media";

export interface InjectPointDetail {
  selector: string;
  position?: InjectPosition; // 默认为 "append"
  order?: number; // 默认为 0
}

export type InjectPointValue = string | InjectPointDetail;
export type InjectPointsConfig = Record<string, InjectPointValue>;
```

### 3.2 插件 Manifest 结构

```ts
export interface PluginManifest {
  name: string;
  version: string;
  minRenderCapability: RenderCapability;
  supportedPlatforms?: Array<"astro" | "universal">;
  entry: Array<RuntimeOnlyEntry | CustomElementEntry | SSREntry>;
}
```

---

## 4. 虚拟模块规范 (`packages/plugin-astro`)

`@hyacine/plugin-astro` 提供了以下 Vite 虚拟模块：

| 虚拟模块 ID                          | 说明               | 生成内容                                                                                  |
| :----------------------------------- | :----------------- | :---------------------------------------------------------------------------------------- |
| `virtual:hyacine/slots/[name].astro` | 动态插槽组件       | 自动聚合所有挂载到 `[name]` 插槽的 SSR 组件，包含 props 注入与 `client:*` 指令。          |
| `virtual:hyacine/slots-manifest`     | 插槽清单静态映射   | 导出 `{ [slotName]: SlotComponent }` 对象，供 `<HyacineOutlet>` 静态分发。                |
| `virtual:hyacine/runtime`            | 客户端聚合 Runtime | 聚合所有 `runtime-only` 插件的 `init(options)` 调用，并在 `DOMContentLoaded` 时自动执行。 |
| `virtual:hyacine/config`             | 插件配置导出       | 导出序列化后的 `HyacinePluginSystemConfig` JSON。                                         |

---

## 5. 使用与开发指南

### 5.1 博客站点配置 (`hyacine.plugin.ts`)

在博客根目录下创建 `hyacine.plugin.ts`：

```ts
import { defineConfig } from "@hyacine/plugin-core";
import siteUptime from "@hyacine/plugin-site-uptime";
import mouseFirework from "@hyacine/plugin-mouse-firework";
import articleAgeWarning from "@hyacine/plugin-article-age-warning";

export default defineConfig({
  injectPoints: {
    // 简写选择器（默认在闭标签前 append）
    "footer-status": ".footer-status",

    // 高级定位（在 .post-body 之后插入）
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

### 5.2 接入 Astro 项目 (`astro.config.mjs`)

```ts
import { defineConfig } from "astro/config";
import { hyacinePlugin } from "@hyacine/plugin-astro";

export default defineConfig({
  integrations: [
    hyacinePlugin(), // 自动加载 hyacine.plugin.ts
  ],
});
```

并在全局 Layout 或主入口 JS 中引入客户端 Runtime：

```astro
---
// src/layouts/Layout.astro
---
<html>
  <head>
    <script>
      import "virtual:hyacine/runtime";
    </script>
  </head>
  <body>
    <slot />
  </body>
</html>
```

### 5.3 主题中声明原生插槽 (可选但推荐)

若在自主开发的主题中使用，可直接引入一等公民 `<HyacineOutlet>` 组件：

```astro
---
import HyacineOutlet from "@hyacine/plugin-astro/components/HyacineOutlet.astro";
const { post } = Astro.props;
---
<article>
  <h1>{post.data.title}</h1>
  <HyacineOutlet name="post-header" context={post} />

  <slot />

  <HyacineOutlet name="post-footer" context={post} />
</article>
```

---

## 6. 开发自定义插件

### 6.1 开发 Runtime-only 插件（如特效或统计）

```ts
// plugins/my-effect/src/runtime.ts
export function init(options: { text?: string }) {
  console.log("Hello from plugin!", options.text);
}

// plugins/my-effect/src/index.ts
import { definePlugin, type PluginManifest } from "@hyacine/plugin-core";

export function myEffect(options = {}): PluginManifest {
  return definePlugin({
    name: "my-effect",
    version: "0.1.0",
    minRenderCapability: "runtime-only",
    entry: [
      {
        name: "my-effect-runtime",
        type: "runtime-only",
        injectPoint: "layout",
        path: new URL("./runtime.ts", import.meta.url).href,
        options,
      },
    ],
  });
}
export default myEffect;
```

### 6.2 开发 SSR 静态组件插件（如文章元数据展示）

```astro
---
// plugins/my-banner/src/Banner.astro
const { hyacineArticle } = Astro.props;
---
<div class="my-banner">
  <p>当前文章：{hyacineArticle?.title ?? "未知"}</p>
</div>
```

```ts
// plugins/my-banner/src/index.ts
import { definePlugin, type PluginManifest } from "@hyacine/plugin-core";

export function myBanner(): PluginManifest {
  return definePlugin({
    name: "my-banner",
    version: "0.1.0",
    minRenderCapability: "ssr",
    supportedPlatforms: ["astro"],
    entry: [
      {
        name: "my-banner-ssr",
        type: "ssr",
        platform: "astro",
        injectPoint: "post-header",
        requiresArticle: true,
        path: new URL("./Banner.astro", import.meta.url).href,
      },
    ],
  });
}
export default myBanner;
```
