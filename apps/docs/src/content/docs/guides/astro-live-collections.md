---
title: Astro Live Collections
description: 深入掌握 @hyacine/sdk/astro 的 hyacineLoader 配置与 Astro 5+ Content Layer 机制。
---

Astro 5+ 引入了革命性的 **Content Layer API**，允许开发者从任意外部数据源加载内容并与 Astro 原生类型系统深度整合。`@hyacine/sdk/astro` 提供了开箱即用的 `hyacineLoader`。

---

## 1. Loader 配置参数全览

`hyacineLoader(options)` 支持丰富的定制选项：

```ts title="src/content.config.ts"
import { defineCollection, z } from "astro:content";
import { hyacineLoader } from "@hyacine/sdk/astro";

export const collections = {
  posts: defineCollection({
    loader: hyacineLoader({
      // [必填] Cloudflare Worker API 根地址
      apiUrl: import.meta.env.HYACINE_API_URL,

      // [必填] 只读或管理员 Token
      token: import.meta.env.HYACINE_READ_TOKEN,

      // [可选] 虚拟路径前缀，默认 "src/posts"
      prefix: "src/posts",

      // [可选] 是否拉取并注入 AI 摘要与元数据，默认 true
      withAiMetadata: true,

      // [可选] 是否在构建期计算全量文章余弦相似度图，默认 true
      calculateSimilarGraph: true,

      // [可选] 每篇文章推荐的 Top-K 关联文章数量，默认 5
      topK: 5,

      // [可选] 相似度判定阈值 (0.0 ~ 1.0)，低于此值的文章不会进入推荐，默认 0.3
      similarityThreshold: 0.3,

      // [可选] 单次批量抓取分页大小，默认 100
      pageSize: 100,
    }),
    schema: ({ image }) =>
      z.object({
        title: z.string(),
        date: z.coerce.date(),
        updated: z.coerce.date().optional(),
        tags: z.array(z.string()).default([]),
        categories: z.array(z.string()).default([]),
        cover: z.union([image(), z.string()]).optional(),
        description: z.string().optional(),
        encrypted: z.boolean().optional(),
        // AI 增强字段
        ai: z
          .object({
            summary: z.object({ summary: z.string().nullable() }).optional(),
          })
          .optional(),
        similarPosts: z
          .array(
            z.object({
              slug: z.string(),
              similarity: z.number(),
            }),
          )
          .optional(),
      }),
  }),
};
```

---

## 2. 增量构建与缓存机制

`hyacineLoader` 原生集成了 Astro 的 `DataStore` 与 `meta.digest` 机制：

1. **Hash 差异比对**：从云端 API 获取文章元数据时，会比对文章的内容哈希 (`content_hash`) 与本地 DataStore 缓存；
2. **免重复解析**：未发生修改的文章直接复用缓存，大幅减少 Markdown 解析耗时；
3. **已删除文章同步清理**：如果云端 D1 删除了某篇文章，Loader 会在构建时自动调用 `store.delete()` 移除对应的 DataStore 条目。

---

## 3. 本地混合模式 (Local Fallback)

如果想在无网络或者本地纯 Markdown 开发时调试，`hyacineLoader` 支持自动回退：

- 当 `apiUrl` 未配置或无法连接时，可配合 Astro 原生 `glob()` loader 作为备选，或在本地启动 `hyc` 本地开发服务器。
