# Astro Live Collections 深度集成指南

`@hyacine/sdk/astro` 实现了 Astro 5+ / 7+ 的 **Content Layer Loader API**，将远程 Cloudflare D1 作为数据库无缝桥接到 Astro 的本地数据流中。

---

## 1. Loader 工作原理

在执行 `astro build` 或 `astro dev` 时，Astro 会调用 `hyacineLoader` 的 `load()` 钩子：

```
                    ┌────────────────────────┐
                    │      Cloudflare D1     │
                    │  (posts + ai_results)  │
                    └───────────┬────────────┘
                                │ 1. 批量快照传输 (GET /api/export + /api/posts)
                                ▼
                    ┌────────────────────────┐
                    │     hyacineLoader      │
                    ├────────────────────────┤
                    │ • 解析 Frontmatter & 正文│
                    │ • 预计算余弦相似度图谱 │
                    │ • Digest 增量缓存比对  │
                    └───────────┬────────────┘
                                │ 2. store.set({ id, data, body, digest })
                                ▼
                    ┌────────────────────────┐
                    │  Astro DataStore 缓存  │
                    │ (.astro/data-store.json│
                    └───────────┬────────────┘
                                │ 3. Astro 渲染引擎 (@astrojs/markdown-satteri)
                                ▼
                         dist/*.html 静态页面
```

---

## 2. 增量构建与缓存机制 (Incremental Builds)

`hyacineLoader` 深度契合 Astro Content Layer 的缓存体系：

1. **Hash 校验与 Digest**：
   Loader 会根据文章内容的 SHA-256 Hash 生成唯一的 `digest`。如果该文章已存在于 `.astro/data-store.json` 且 `digest` 没有变化，Astro 将跳过对该 Markdown 正文的二次 AST 重新解析，极大加快大型站点的构建速度。

2. **自动清理已下架文章**：
   若某篇文章在管理台或 D1 中被软删除或彻底清理，Loader 会检测到差异，并主动调用 `store.delete(id)` 从本地 Store 中将其剔除，避免静态产物残留。

---

## 3. 多集合支持（文章 Posts 与 说说/动态 Moments）

若博客包含多个内容集合，可以为每个集合配置独立的 `hyacineLoader` 实例，通过 `prefix` 进行隔离：

```ts
// src/content.config.ts
import { defineCollection, z } from "astro:content";
import { hyacineLoader } from "@hyacine/sdk/astro";

const commonConfig = {
  apiUrl: process.env.HYACINE_API_URL!,
  token: process.env.HYACINE_READ_TOKEN,
};

// 1. 博客文章集合
const posts = defineCollection({
  loader: hyacineLoader({
    ...commonConfig,
    prefix: "src/posts",
    withAiMetadata: true,
    calculateSimilarGraph: true,
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      date: z.coerce.date(),
      tags: z.array(z.string()).optional(),
      categories: z.array(z.string()).optional(),
      cover: z.union([image(), z.string()]).optional(),
    }),
});

// 2. 说说/动态集合
const moments = defineCollection({
  loader: hyacineLoader({
    ...commonConfig,
    prefix: "src/moments",
    withAiMetadata: false, // 动态通常不需要 AI 摘要
    calculateSimilarGraph: false, // 动态不需要相似文章推荐
  }),
  schema: ({ image }) =>
    z.object({
      date: z.coerce.date(),
      images: z.array(z.union([z.string(), image()])).optional(),
    }),
});

export const collections = { posts, moments };
```

---

## 4. 与 Satteri 插件生态无缝兼容

`astro-blog-shokax` 使用了 `@astrojs/markdown-satteri` 及若干自定义 Markdown 插件。

`hyacineLoader` 在存储条目时，通过 `store.set({ body: post.content })` 提供了纯净正文字符串，因此以下插件在纯静态 SSG 编译期**完全保持原生体验**：

- `:::note` / `:::spoiler` / `:::tabs` 等容器指令
- 行内标注插件（如 `:::ruby{text="..."}`、`:::ins` 等）
- KaTeX 数学公式（`$...$` 和 `$$...$$`）
- Shiki / Expressive Code 代码组（`:::code-group`）
- 图片灯箱与外部链接包裹处理
