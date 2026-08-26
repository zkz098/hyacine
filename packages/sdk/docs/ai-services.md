# AI 服务与图谱预烘焙指南

`@hyacine/sdk/ai` 提供了全套 AI 辅助函数与高层客户端，涵盖构建期向量图谱预烘焙、卡片摘要智能降级提取、文本安全分块与静态语义搜索。

---

## 1. 构建期全站相似文章图谱预烘焙 (Similarity Graph)

在纯 SSG 静态模式下，页面编译成 HTML 后无法在客户端执行繁重的余弦相似度计算。`@hyacine/sdk` 的解决方案是：**在 SSG 构建期，利用 D1 存储的向量一次性在内存中完成全站 Top-K 矩阵计算并注入页面**。

### 手动调用计算矩阵

```ts
import { computeGlobalSimilarity } from "@hyacine/sdk/astro";
import type { PostWithAi } from "@hyacine/sdk";

// 批量计算全站相似度（阈值 0.4，最多取 5 篇）
const similarityMap = computeGlobalSimilarity(posts, {
  limit: 5,
  minSimilarity: 0.4,
});

// 获取某篇文章的推荐列表
const recommendations = similarityMap.get("my-first-post");
// 返回: [{ slug, title, path, score, category, cover, date }]
```

---

## 2. 卡片摘要智能提取 (resolveCardExcerpt)

在列表页、首页或 RSS 订阅中，不同文章可能存在：

- 手动编写的 `description`
- 云端生成的 `ai.summary`
- 未提供任何摘要，仅有 Markdown 正文

`resolveCardExcerpt` 支持多种优先级策略，并自动剔除 Markdown 特殊符号、HTML 标签与代码块：

```ts
import { resolveCardExcerpt } from "@hyacine/sdk/ai";

// 1. 优先使用 AI 摘要（若无则回退到 description，再回退到正文截断）
const excerptAi = resolveCardExcerpt(post, {
  strategy: "ai",
  maxLength: 140,
});

// 2. 优先使用手写描述（若无则使用 AI 摘要，再回退到正文截断）
const excerptDesc = resolveCardExcerpt(post, {
  strategy: "description",
  maxLength: 140,
});
```

---

## 3. 结构感知分块与加密隐私防护 (chunkArticleForEmbedding)

在为文章生成向量嵌入时，必须兼顾语义完整度与用户隐私：

```ts
import { chunkArticleForEmbedding, isArticleEncrypted } from "@hyacine/sdk/ai";

const rawContent = `---
title: My Article
encrypted: true
---
Confidential text
`;

// 1. 严格阻断加密文章
if (isArticleEncrypted(rawContent)) {
  console.log("加密文章，跳过 AI 向量化以保护隐私！");
}

// 2. 正常文章按标题与段落切分
const chunks = chunkArticleForEmbedding(normalContent, {
  maxChunkSize: 800,
  overlap: 100,
});
```

---

## 4. 独立 AI 客户端 (HyacineAiClient)

若需要在自定义脚本、CI 或外部 Node.js 服务中直接与 Hyacine AI 端点交互，可使用 `HyacineAiClient`：

```ts
import { HyacineAiClient } from "@hyacine/sdk/ai";

const aiClient = new HyacineAiClient({
  apiUrl: "https://api.hyacine.example.com",
  token: "hyc_tok_admin_xxx",
});

// 1. 请求单篇文章摘要
const summaryRes = await aiClient.getPostSummary({
  hash: "abc12345...",
  content: "文章全文 Markdown...",
});
console.log(summaryRes?.summary);

// 2. 自动分块并生成向量
const embedRes = await aiClient.generateEmbeddings({
  hash: "abc12345...",
  content: "文章全文 Markdown...",
});
console.log(`生成完成: 维度 ${embedRes?.dim}, 块数 ${embedRes?.chunkCount}`);
```
