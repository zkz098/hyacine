---
title: Plugin 架构与契约规范
description: 查看 Hyacine 插件系统的 Zod 契约、类型定义与规范参考。
---

Hyacine 插件系统的全部数据结构与配置均由 `@hyacine/contract` 提供强类型的 Zod Schema 校验。

---

## 1. 核心枚举与类型

### `RenderCapability`

```ts
export type RenderCapability = "runtime-only" | "custom-element" | "ssr";
```

### `InjectPosition`

```ts
export type InjectPosition = "before" | "after" | "prepend" | "append";
```

### `HydrationInstruction`

```ts
export type HydrationInstruction = "load" | "idle" | "visible" | "media";
```

---

## 2. 注入点配置 (`InjectPointsConfig`)

```ts
export interface InjectPointDetail {
  /** CSS 选择器（支持 tag, .class, #id） */
  selector: string;
  /** 注入方位，默认为 "append" */
  position?: InjectPosition;
  /** 排序权重，默认为 0 */
  order?: number;
}

export type InjectPointValue = string | InjectPointDetail;

export type InjectPointsConfig = Record<string, InjectPointValue>;
```

---

## 3. 插件 Manifest (`PluginManifest`)

```ts
export interface BaseInjectEntry {
  name: string;
  path: string;
  injectPoint?: string;
  order?: number;
}

export interface RuntimeOnlyEntry extends BaseInjectEntry {
  type: "runtime-only";
  options?: Record<string, unknown>;
}

export interface CustomElementEntry extends BaseInjectEntry {
  type: "custom-element";
  injectPoint: string; // 默认为 "layout"
}

export interface SSREntry extends BaseInjectEntry {
  type: "ssr";
  platform?: "astro" | "universal";
  requiresArticle?: boolean;
  clientHydrationInstruction?: HydrationInstruction;
  props?: Record<string, unknown>;
}

export interface PluginManifest {
  name: string;
  version: string;
  minRenderCapability: RenderCapability;
  supportedPlatforms?: Array<"astro" | "universal">;
  compatibleAPIPattern?: string;
  entry: Array<RuntimeOnlyEntry | CustomElementEntry | SSREntry>;
}
```

---

## 4. 主配置契约 (`HyacinePluginSystemConfig`)

```ts
export interface HyacinePluginSystemConfig {
  injectPoints?: InjectPointsConfig;
  postCollection?: string; // 默认为 "posts"
  plugins?: PluginManifest[];
}
```
