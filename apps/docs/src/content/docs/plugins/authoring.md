---
title: 开发自定义插件
description: 学习如何使用 @hyacine/plugin-core 开发、打包与发布自己的 Hyacine 插件。
---

开发一个 Hyacine 插件非常简单。借助 `@hyacine/plugin-core` 提供的 `definePlugin` 辅助函数，你可以轻松构建具有完整 TypeScript 类型推导的插件。

---

## 1. 开发客户端 Runtime 插件

Runtime-only 插件适合实现**纯前端特效、DOM 增强或第三方统计**。

### 目录结构

```
my-firework-plugin/
├── package.json
├── src/
│   ├── index.ts      # 插件 Manifest 导出
│   └── runtime.ts    # 客户端执行逻辑
└── tsconfig.json
```

### 1. 编写客户端入口 (`runtime.ts`)

```ts title="src/runtime.ts"
export interface FireworkOptions {
  particleCount?: number;
  color?: string;
}

export function init(options: FireworkOptions = {}): void {
  if (typeof window === "undefined") return;

  const { particleCount = 20, color = "#ff0000" } = options;

  window.addEventListener("click", (e) => {
    console.log(`Spawn ${particleCount} particles with color ${color} at`, e.clientX, e.clientY);
    // 实现具体特效...
  });
}

export default { init };
```

### 2. 编写插件 Manifest (`index.ts`)

```ts title="src/index.ts"
import { definePlugin, type PluginManifest } from "@hyacine/plugin-core";
import type { FireworkOptions } from "./runtime";

export function fireworkPlugin(options: FireworkOptions = {}): PluginManifest {
  return definePlugin({
    name: "my-firework-plugin",
    version: "0.1.0",
    minRenderCapability: "runtime-only",
    entry: [
      {
        name: "firework-runtime",
        type: "runtime-only",
        injectPoint: "layout",
        path: new URL("./runtime.ts", import.meta.url).href,
        options: {
          particleCount: options.particleCount ?? 20,
          color: options.color ?? "#ff0000",
        },
      },
    ],
  });
}

export default fireworkPlugin;
```

---

## 2. 开发 SSR 静态组件插件

SSR 插件适合实现**文章元数据展示、文章过期提示、版权卡片**等，在 SSG 构建期直接生成 HTML，不产生额外客户端 JS 开销。

### 目录结构

```
my-warning-plugin/
├── package.json
├── src/
│   ├── index.ts       # 插件入口
│   └── Warning.astro  # Astro 模板组件
└── tsconfig.json
```

### 1. 编写 Astro 组件 (`Warning.astro`)

组件会通过 `Astro.props.hyacineArticle` 自动接收当前文章的上下文：

```astro title="src/Warning.astro"
---
// 获取当前文章数据（含 Frontmatter / AI 摘要 / 日期等）
const article = Astro.props.hyacineArticle;
const { alertText = "注意：本文发布较早" } = Astro.props;

const date = article?.data?.date ?? article?.date;
const isOld = date && Date.now() - new Date(date).getTime() > 180 * 24 * 3600 * 1000;
---

{
  isOld ? (
    <div class="custom-warning-banner" style="padding: 1rem; background: #fff3cd; border-left: 4px solid #ffc107;">
      <p>{alertText}</p>
    </div>
  ) : null
}
```

### 2. 编写插件 Manifest (`index.ts`)

```ts title="src/index.ts"
import { definePlugin, type PluginManifest } from "@hyacine/plugin-core";

export interface WarningOptions {
  alertText?: string;
  injectPoint?: string;
  order?: number;
}

export function warningPlugin(options: WarningOptions = {}): PluginManifest {
  return definePlugin({
    name: "my-warning-plugin",
    version: "0.1.0",
    minRenderCapability: "ssr",
    supportedPlatforms: ["astro"],
    entry: [
      {
        name: "warning-ssr",
        type: "ssr",
        platform: "astro",
        injectPoint: options.injectPoint ?? "post-header",
        requiresArticle: true,
        order: options.order ?? 0,
        path: new URL("./Warning.astro", import.meta.url).href,
        props: {
          alertText: options.alertText ?? "注意：本文发布较早",
        },
      },
    ],
  });
}

export default warningPlugin;
```

---

## 3. 支持客户端水合指令 (`clientHydrationInstruction`)

如果你的 SSR 组件包含客户端交互（如 React/Solid/Vue 编写的动态点赞按钮），可在 entry 中声明水合指令：

```ts title="src/index.ts"
entry: [
  {
    name: "reactions-widget",
    type: "ssr",
    platform: "astro",
    injectPoint: "post-footer",
    path: new URL("./Reactions.astro", import.meta.url).href,
    // 声明为可见时水合
    clientHydrationInstruction: "visible",
  },
];
```

Astro 在编译该虚拟插槽时会自动为其附加 `client:visible` 指令。
