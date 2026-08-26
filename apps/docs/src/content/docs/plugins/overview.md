---
title: 插件系统总览与架构
description: 深入了解 Hyacine 插件系统的分层渲染能力模型、Vite 虚拟模块调度与设计哲学。
---

Hyacine 插件系统致力于打破“主题与功能特性强耦合”的传统痛点，为现代静态博客生态提供**平台中立、主题解耦、分层渲染与端到端类型安全**的扩展框架。

---

## 1. 核心架构设计

Hyacine 插件架构由四个核心层次构成：

```
┌────────────────────────────────────────────────────────┐
│               配置层 (hyacine.plugin.ts)                │
│             类型安全的 definePlugin / defineConfig     │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│              调度内核 (@hyacine/plugin-core)           │
│        Manifest 校验 / 插槽分组 / Order 权重排序        │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│            Astro 编译引擎 (@hyacine/plugin-astro)      │
│  <HyacineOutlet> 声明式插槽 ↔ AST 零侵入注入引擎 (双模) │
│       virtual:hyacine/* 虚拟模块编译期动态聚合           │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                渲染运行时 (Render Output)               │
│  SSR 静态生成 HTML (零冷启动) + 客户端 Runtime 轻量调度 │
└────────────────────────────────────────────────────────┘
```

---

## 2. 分层渲染能力模型 (`RenderCapability`)

每个插件在声明 Manifest 时，需要指定其最小渲染能力等级（`minRenderCapability`）：

### 1. `runtime-only`（纯客户端运行时）

- **定位**：仅在浏览器端挂载，无服务端/构建时模板依赖；
- **典型场景**：鼠标点击烟花、背景气泡特效、建站时间实时时钟、第三方统计代码；
- **入口约定**：导出一个 `init(options)` 函数，由 `virtual:hyacine/runtime` 统一引入执行。

### 2. `custom-element`（通用 Web Component）

- **定位**：基于 Web Components 标准封装的跨框架通用组件；
- **典型场景**：通用音乐播放器（如 `nyx-player`）、通用评论框组件。

### 3. `ssr`（服务端/静态构建期组件）

- **定位**：运行在 Astro SSG 构建期，直接输出静态 HTML；
- **特性**：
  - **零客户端 JS 开销**：若未指定水合指令，仅输出纯静态标签；
  - **支持 Astro 客户端水合**：可通过 `clientHydrationInstruction` 声明 `client:load` / `client:visible` / `client:idle` / `client:media`；
  - **上下文感知**：自动接收当前文章的强类型元数据（`hyacineArticle`），例如发布日期、分类、AI 摘要等。

---

## 3. Vite 虚拟模块体系

`@hyacine/plugin-astro` 在构建期负责生成以下虚拟模块，实现真正的**按需零侵入编译**：

| 虚拟模块路径                         | 功能说明                                                             |
| :----------------------------------- | :------------------------------------------------------------------- |
| `virtual:hyacine/slots/[name].astro` | 动态插槽组件：根据配置自动聚合挂载到 `[name]` 的所有 SSR 插件。      |
| `virtual:hyacine/slots-manifest`     | 插槽映射清单：导出静态插槽字典，供 `<HyacineOutlet>` 派发。          |
| `virtual:hyacine/runtime`            | 客户端 Runtime：聚合所有 `runtime-only` 插件的初始化逻辑，开箱即用。 |
| `virtual:hyacine/config`             | 运行时配置：序列化导出当前工程的插件系统配置。                       |

---

## 4. 排序与优先级调度 (`Order Scheduling`)

当多个插件注册在同一个插槽（如 `post-footer`）时，系统支持通过 `order` 字段（升序排序，默认 `0`）精确控制组件的展示顺序：

```ts title="hyacine.plugin.ts"
export default defineConfig({
  plugins: [
    // order 0: 优先展示过时警告
    articleAgeWarning({ maxAgeDays: 180 }),
    // order 10: 随后展示版权声明
    copyrightNotice({ order: 10 }),
    // order 20: 最后展示点赞按钮
    reactionButtons({ order: 20 }),
  ],
});
```
