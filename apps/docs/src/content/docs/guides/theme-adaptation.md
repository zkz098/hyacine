---
title: 摘要提取与主题适配
description: 适配 astro-blog-shokax 等主流主题的卡片摘要、封面图与加密文章展示。
---

Hyacine 旨在无缝兼容现有博客主题模板（如 [astro-blog-shokax](https://github.com/zkz098/astro-blog-shokax)）。

---

## 1. 摘要提取器 (`extractExcerpt`)

`@hyacine/sdk` 提供了健壮的摘要提取辅助函数：

```ts
import { extractExcerpt } from "@hyacine/sdk";

const excerpt = extractExcerpt({
  frontmatterDescription: post.data.description,
  aiSummary: post.data.ai?.summary?.summary,
  body: post.body,
  maxLength: 150,
});
```

### 降级优先级规则

1. **手动指定（第一优先级）**：若博文 Frontmatter 明确书写了 `description`，优先使用人工设定的摘要；
2. **AI 生成（第二优先级）**：若未写 `description`，则读取由 Workers AI（或 BYOK 大模型）生成的智能精炼摘要；
3. **正文提取（保底优先级）**：自动剥离 Markdown 语法标记（如 `#` 标题、`![]()` 图片、HTML 标签、代码块等），截取前 150 字纯文本。

---

## 2. 封面图与 R2 资产管道

当在文章中引用图片资产时，Hyacine 支持多种封面图来源：

- **本地相对路径**：如 `./cover.jpg`，通过 Astro 内置 `image()` schema 优化；
- **R2 直传 CDN URL**：如 `https://assets.yourdomain.com/images/2026/08/hero.webp`，通过 Cloudflare R2 存储桶直连加速。

---

## 3. 加密与受保护文章处理

若文章标记为私密内容：

```yaml title="post.md frontmatter"
---
title: 内部技术复盘
date: 2026-08-26
encrypted: true
---
```

Hyacine 会在构建期和 API 层做如下保护：

- `ai.summary` 自动留空或标记为受保护；
- 排除在 Workers AI 嵌入生成队列之外；
- 前端渲染组件可显示挂锁图标 🔒 并提示输入访问密码。
