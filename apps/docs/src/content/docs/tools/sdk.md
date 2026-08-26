---
title: TypeScript SDK (@hyacine/sdk)
description: "@hyacine/sdk 架构、模块导出与 API 客户端使用指南。"
---

`@hyacine/sdk` 是 Hyacine 的通用客户端与 Astro 集成核心库。

---

## 1. 模块导出全览

SDK 采用 ESM 条件导出（Conditional Exports），分为三大入口：

```ts
// 1. 主入口: 基础客户端、公共工具函数与类型
import { createHyacineClient, extractExcerpt } from "@hyacine/sdk";

// 2. Astro 专用入口: Content Layer Loader
import { hyacineLoader } from "@hyacine/sdk/astro";

// 3. AI 计算专用入口: 向量图矩阵拓扑算法
import { calculateSimilarityMatrix, cosineSimilarity } from "@hyacine/sdk/ai";
```

---

## 2. 基础 API 客户端 (`createHyacineClient`)

用于在 Node.js 脚本、构建插件或外部服务中直接操作 Hyacine 后端：

```ts
import { createHyacineClient } from "@hyacine/sdk";

const client = createHyacineClient({
  baseUrl: "https://hyacine-api.example.workers.dev",
  token: "hyc_tok_admin_xxxxxxxx",
});

// 获取所有文章列表
const posts = await client.posts.list({
  page: 1,
  limit: 20,
  tag: "astro",
});

// 获取单篇文章详情
const post = await client.posts.getBySlug("my-first-post");

// 创建或更新文章
await client.posts.upsert({
  slug: "my-first-post",
  title: "我的第一篇博客",
  content: "# Hello World\n\n欢迎来到我的博客！",
  tags: ["astro", "hyacine"],
});
```

---

## 3. 核心工具方法

### `extractExcerpt(options)`

根据多级降级规则提取摘要纯文本。

### `calculateSimilarityMatrix(embeddings, options)`

根据高维向量数组计算拓扑图关联，返回包含 `topK` 相似度的邻接表。
