---
title: Contract 类型与数据模型
description: "@hyacine/contract 核心 Zod Schema、TS 类型定义与零依赖 API 契约设计。"
---

`@hyacine/contract` 是 Hyacine 的**单一事实来源契约库（Single Source of Truth）**，确保 API Worker、CLI、Desktop、Console 和 SDK 在数据结构上严格统一。

---

## 1. 核心数据模型 (Schemas)

### 博文元数据 (`postSchema`)

```ts
import { z } from "zod";

export const postSchema = z.object({
  id: z.number().int().positive().optional(),
  path: z.string(), // 仓库相对路径，如 "src/posts/guide.md"
  slug: z.string(), // 唯一标识
  title: z.string(),
  content: z.string(), // 完整 Markdown 源码
  draft: z.boolean().default(false),
  categories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  cover: z.string().optional(),
  description: z.string().optional(),
  encrypted: z.boolean().default(false),
  hash: z.string(), // rapidhash 64位内容校验和
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
```

### AI 产物模型 (`aiResultSchema`)

```ts
export const aiResultSchema = z.object({
  hash: z.string(), // 绑定的文章内容哈希
  summary: z.string().nullable(),
  summary_model: z.string().nullable(),
  embed_vec: z.array(z.number()).nullable(), // 1024 维密集浮点向量
  embed_dim: z.number().int().optional(),
});
```

---

## 2. 零依赖契约客户端 (`createApiClient`)

无需引入 Axios 或重量级 SDK，`@hyacine/contract` 自带极简原生 `fetch` 客户端：

```ts
import { createApiClient } from "@hyacine/contract";

const api = createApiClient({
  baseUrl: "https://api.hyacine.dev",
  token: "my-token",
});

const { data, error } = await api.posts.get("hello-world");
```
