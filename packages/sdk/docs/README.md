# @hyacine/sdk 文档指南

`@hyacine/sdk` 是面向 Astro 博客（如 `astro-blog-shokax`）与无头内容管理系统的官方 TypeScript SDK。

它基于 **Cloudflare D1 作为唯一长期存储与真相源（Single Source of Truth, SoT）**，结合 **Astro 5+ / 7+ Content Layer**，让静态博客在保持 **100% 纯静态生成（SSG）** 交付形态的同时，彻底消除本地 Git 仓库中的 Markdown/MDX 文件管理负担。

---

## 核心能力

1. **Astro SSG Live Collections (`@hyacine/sdk/astro`)**
   - 通过 `hyacineLoader` 在 `astro build` 构建期直接连接 Cloudflare Worker API 并批量提取 D1 内容。
   - 自动解析 Frontmatter 与正文，完全兼容 `@astrojs/markdown-satteri` 与 Satteri 自定义插件体系（`note`, `spoiler`, `ruby`, `katex`, `code-group` 等）。
   - 内置基于 Hash 的增量缓存比对（Astro DataStore Digest），二次构建毫秒级响应。
   - 构建期自动计算全站余弦相似度图谱，零运行时网络开销预烘焙 `similarPosts`。

2. **AI 服务与增强工具集 (`@hyacine/sdk/ai`)**
   - **智能摘要与卡片提取**：自动将 D1 中的 AI 摘要对齐至文章元数据，提供 `resolveCardExcerpt` 智能多源回退（Frontmatter 描述 > AI 摘要 > 正文去格式截断）。
   - **全站向量计算与图谱**：内存级余弦相似度计算器与 Top-K 推荐生成器。
   - **结构感知分块与隐私阻断**：按 Markdown 标题分小节切分 Chunk，自动识别 `encrypted: true` 与 `password` 字段并严格阻断向 AI 端点发送敏感数据。
   - **静态语义搜索索引**：构建期导出紧凑型向量索引文件，赋能浏览器端轻量语义检索。

3. **全功能独立客户端 (`HyacineAiClient`)**
   - 封装 Cloudflare Workers AI 与 BYOK OpenAI 兼容端点的摘要生成、向量嵌入与状态查询。

---

## 目录导航

- [快速入门](./quickstart.md) —— 3 分钟为你的 Astro 博客接入 D1 Live Collections
- [Astro Live Collections 深度指南](./astro-live-collections.md) —— Loader 配置、增量构建与多集合
- [AI 服务与图谱预烘焙指南](./ai-services.md) —— 相似推荐、智能摘要与语义搜索
- [完整 API 参考手册](./api-reference.md) —— 类型定义、函数签名与异常处理
