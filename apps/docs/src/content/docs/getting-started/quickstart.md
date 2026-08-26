---
title: 快速上手 (Quickstart)
description: 5 分钟内将 Hyacine SDK 集成到现有的 Astro 5+ 博客中。
---

本指南将带你在现有 Astro 项目中接入 `@hyacine/sdk`，使用 Astro 5+ 的 Content Layer 直接从 Hyacine 云端 D1 数据库拉取文章，并在构建期烘焙 AI 向量相似推荐。

---

## 1. 安装 SDK

在你的 Astro 博客根目录下安装 `@hyacine/sdk`：

```bash
# 使用 pnpm (推荐)
pnpm add @hyacine/sdk

# 使用 npm
npm install @hyacine/sdk

# 使用 yarn
yarn add @hyacine/sdk
```

---

## 2. 配置环境变量

在 Astro 项目根目录的 `.env` 中增加 Hyacine Worker API 的访问地址和只读 Token：

```ini title=".env"
# 你的 Hyacine Cloudflare Worker 访问地址
HYACINE_API_URL=https://hyacine-api.your-subdomain.workers.dev

# 具备只读权限的 Token (在 Console 管理台生成)
HYACINE_READ_TOKEN=hyc_tok_read_xxxxxxxxxxxxxxxx
```

---

## 3. 配置 Astro Content Layer

修改或创建 `src/content.config.ts`，使用 `hyacineLoader` 定义文章集合：

```ts title="src/content.config.ts"
import { defineCollection, z } from "astro:content";
import { hyacineLoader } from "@hyacine/sdk/astro";

export const collections = {
  posts: defineCollection({
    loader: hyacineLoader({
      apiUrl: import.meta.env.HYACINE_API_URL,
      token: import.meta.env.HYACINE_READ_TOKEN,
      prefix: "src/posts", // 统一路径前缀
      withAiMetadata: true, // 启用 AI 摘要元数据注入
      calculateSimilarGraph: true, // 启用构建期高维向量相似度图计算
      topK: 5, // 关联相似文章数量 (默认 5 篇)
    }),
    schema: ({ image }) =>
      z.object({
        title: z.string(),
        date: z.coerce.date(),
        tags: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
        cover: z.union([image(), z.string()]).optional(),
        // 自动注入的 AI 摘要结构
        ai: z
          .object({
            summary: z.object({ summary: z.string().nullable() }).optional(),
          })
          .optional(),
        // 自动注入的相似文章推荐列表
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

## 4. 在 Astro 页面中渲染内容

在动态路由页面（例如 `src/pages/posts/[...slug].astro`）中获取并渲染文章：

```astro title="src/pages/posts/[...slug].astro"
---
import { getCollection, render } from "astro:content";

export async function getStaticPaths() {
  const posts = await getCollection("posts");
  return posts.map((post) => ({
    params: { slug: post.id },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await render(post);
---

<article>
  <h1>{post.data.title}</h1>
  <time>{post.data.date.toISOString().slice(0, 10)}</time>

  <!-- 显示 AI 生成的摘要 (如果有) -->
  {post.data.ai?.summary?.summary && (
    <aside class="ai-summary">
      <strong>🤖 AI 摘要：</strong>
      <p>{post.data.ai.summary.summary}</p>
    </aside>
  )}

  <!-- 渲染 Markdown/MDX 正文 -->
  <Content />

  <!-- 显示 Top-K 推荐相关文章 -->
  {post.data.similarPosts && post.data.similarPosts.length > 0 && (
    <section class="similar-posts">
      <h3>相关推荐文章</h3>
      <ul>
        {post.data.similarPosts.map((sim) => (
          <li>
            <a href={`/posts/${sim.slug}`}>
              {sim.slug} (相似度: {(sim.similarity * 100).toFixed(1)}%)
            </a>
          </li>
        ))}
      </ul>
    </section>
  )}
</article>
```

---

## 5. 执行静态构建

运行常规的 Astro 静态构建命令：

```bash
pnpm run build
```

在终端中，你将看到 `hyacineLoader` 自动完成：

1. 从 D1 批量拉取所有已发布的文章快照；
2. 自动载入 Worker AI 计算好的 BGE-M3 高维向量嵌入；
3. 在内存中实时完成余弦相似度全图计算；
4. 将关联文章和摘要注入 Astro DataStore；
5. 输出 100% 纯静态 HTML。
