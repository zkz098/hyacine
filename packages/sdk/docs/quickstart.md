# 快速入门 (Quickstart)

本指南演示如何在 Astro 博客项目（例如 `astro-blog-shokax`）中使用 `@hyacine/sdk`，将内容源从本地文件切换到 Cloudflare D1 远程数据库，并保留纯静态 SSG 部署。

---

## 1. 安装依赖

在博客项目根目录下安装 `@hyacine/sdk`：

```bash
pnpm add @hyacine/sdk
```

---

## 2. 配置环境变量

在 `.env` 或 CI/CD（GitHub Actions / Cloudflare Pages）中配置访问凭证（只需要只读 Token）：

```env
# Cloudflare Worker 部署的 API 地址
HYACINE_API_URL=https://api.hyacine.example.com

# 具有 posts.r 权限的只读 Token（在管理台或通过 CLI tokens:create 生成）
HYACINE_READ_TOKEN=hyc_tok_xxxxxx
```

---

## 3. 修改 Content Collections 配置

编辑博客的 `src/content.config.ts`，将本地 `glob` loader 替换为 `hyacineLoader`：

```ts
// src/content.config.ts
import { defineCollection, z } from "astro:content";
import { hyacineLoader } from "@hyacine/sdk/astro";

const posts = defineCollection({
  loader: hyacineLoader({
    apiUrl: import.meta.env.HYACINE_API_URL || process.env.HYACINE_API_URL!,
    token: import.meta.env.HYACINE_READ_TOKEN || process.env.HYACINE_READ_TOKEN,
    prefix: "src/posts",
    withAiMetadata: true, // 自动合并 AI 摘要元数据
    calculateSimilarGraph: true, // 构建期自动计算相似文章
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      tags: z.array(z.string()).nullable().optional(),
      categories: z.array(z.string()).nullable().optional(),
      draft: z.boolean().optional(),
      cover: z.union([image(), z.string()]).optional(),
      // 加密支持
      encrypted: z.boolean().default(false),
      password: z.string().optional(),
      // SDK 自动注入的 AI 数据字段
      ai: z
        .object({
          summary: z
            .object({
              summary: z.string().nullable().optional(),
              model: z.string().nullable().optional(),
              generatedAt: z.string().nullable().optional(),
            })
            .optional(),
          similarPosts: z
            .array(
              z.object({
                slug: z.string(),
                title: z.string(),
                score: z.number(),
                path: z.string(),
                cover: z.string().optional(),
                category: z.string().optional(),
                date: z.string().optional(),
              }),
            )
            .optional(),
        })
        .optional(),
      // 预烘焙相似推荐列表快捷别名
      similarPosts: z.array(z.any()).optional(),
    }),
});

export const collections = { posts };
```

---

## 4. 在文章页面中消费数据

在 `src/pages/posts/[...slug].astro` 中：

```astro
---
import { getCollection, render } from "astro:content";
import AiSummaryCard from "@/components/post/AiSummaryCard.astro";
import AiSimilarPosts from "@/components/post/AiSimilarPosts.astro";

export async function getStaticPaths() {
  const posts = await getCollection("posts");
  return posts
    .filter((post) => !post.data.draft)
    .map((post) => ({
      params: { slug: post.id },
      props: { post },
    }));
}

const { post } = Astro.props;
const { Content } = await render(post);

// 直接从预注入数据中获取 AI 摘要和相似推荐，无需任何异步请求！
const aiSummary = post.data.ai?.summary?.summary;
const aiModel = post.data.ai?.summary?.model;
const similarPosts = post.data.similarPosts || [];
---

<article>
  <h1>{post.data.title}</h1>

  <!-- AI 摘要卡片 -->
  {aiSummary && (
    <AiSummaryCard summary={aiSummary} model={aiModel} showModel={true} />
  )}

  <!-- 正文渲染（Satteri 插件如 spoiler/note/katex 均正常生效） -->
  <div class="content">
    <Content />
  </div>

  <!-- 构建期预烘焙的相似文章推荐 -->
  {similarPosts.length > 0 && (
    <AiSimilarPosts posts={similarPosts} />
  )}
</article>
```

---

## 5. 执行静态构建

运行标准的 Astro 静态构建命令：

```bash
pnpm run build
```

`@hyacine/sdk` 会在控制台中输出同步进度：

```text
[hyacine-loader] 连接 D1 节点: https://api.hyacine.example.com (prefix: src/posts)
[hyacine-loader] 命中 42 篇 D1 文章，开始处理...
[hyacine-loader] 同步完成: 写入/更新 42 篇, 保留增量缓存.
```

构建生成的 `dist/` 为 **100% 纯静态 HTML**，可部署到 GitHub Pages、Cloudflare Pages、Vercel 或任何 CDN 托管。
