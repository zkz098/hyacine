# @hyacine/plugin-core

Hyacine 插件系统的核心契约与标准化工具库。

## 安装

```bash
pnpm add @hyacine/plugin-core
```

## 功能特性

- **类型安全的 Manifest 声明**：通过 `definePlugin` 声明并验证插件元数据；
- **配置标准化与校验**：通过 `defineConfig` 解析并校验 `hyacine.plugin.ts`；
- **插槽分组与权重排序**：提供 `groupEntriesBySlot` 和 `collectRuntimeEntries` 调度能力。

## 快速使用

```ts
import { definePlugin, type PluginManifest } from "@hyacine/plugin-core";

export function myPlugin(options = {}): PluginManifest {
  return definePlugin({
    name: "my-plugin",
    version: "0.1.0",
    minRenderCapability: "runtime-only",
    entry: [
      {
        name: "my-plugin-runtime",
        type: "runtime-only",
        injectPoint: "layout",
        path: new URL("./runtime.ts", import.meta.url).href,
        options,
      },
    ],
  });
}
```
