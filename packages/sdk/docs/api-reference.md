# 完整 API 参考手册 (API Reference)

## 模块总览

`@hyacine/sdk` 提供 3 个导出入口：

- `@hyacine/sdk`：全功能主入口
- `@hyacine/sdk/astro`：Astro Live Collections 与构建期图谱计算
- `@hyacine/sdk/ai`：AI 算法工具、分块清洗与独立客户端

---

## 1. `@hyacine/sdk/astro`

### `hyacineLoader(options: HyacineLoaderOptions): AstroLoader`

创建适用于 Astro 5+ / 7+ Content Layer 的远程 D1 集合加载器。

#### 参数 `HyacineLoaderOptions`

| 字段                    | 类型                | 必填 | 说明                                    |
| :---------------------- | :------------------ | :--- | :-------------------------------------- |
| `apiUrl`                | `string`            | 是   | Cloudflare Worker API 根地址            |
| `token`                 | `string`            | 否   | 只读凭证（具有 `posts.r` scope）        |
| `prefix`                | `string`            | 否   | 集合目录过滤（如 `"src/posts"`）        |
| `withAiMetadata`        | `boolean`           | 否   | 是否自动拉取并注入 AI 摘要，默认 `true` |
| `calculateSimilarGraph` | `boolean`           | 否   | 是否在构建期预计算相似文章，默认 `true` |
| `similarOptions`        | `SimilarityOptions` | 否   | 相似度推荐阈值与条数控制                |
| `customFetch`           | `typeof fetch`      | 否   | 自定义 fetch 实例（用于测试/代理）      |

---

### `computeGlobalSimilarity(posts: PostWithAi[], options?: SimilarityOptions): Map<string, SimilarPostItem[]>`

在内存中遍历全量文章，根据向量计算余弦相似度并产出 Top-K 映射表。

#### 参数 `SimilarityOptions`

| 字段            | 类型      | 默认值 | 说明                           |
| :-------------- | :-------- | :----- | :----------------------------- |
| `limit`         | `number`  | `5`    | 每篇文章最多推荐条数           |
| `minSimilarity` | `number`  | `0.4`  | 最低相似度阈值（[-1, 1] 之间） |
| `excludeSelf`   | `boolean` | `true` | 是否排除自身                   |

---

## 2. `@hyacine/sdk/ai`

### `cosineSimilarity(a: number[], b: number[]): number`

计算两个浮点数组的余弦相似度。异常或零向量返回 `0`。

### `stripMarkdown(content: string): string`

深度剔除 Markdown 正文中的 Frontmatter、代码块、HTML、Satteri 指令与格式符号，输出纯文本。

### `resolveCardExcerpt(post: PostExcerptSource, options?: CardExcerptOptions): string`

智能解析卡片摘要。

- `options.strategy`: `"ai" | "description" | "auto" | "default"`
- `options.maxLength`: 截断最大字符数（默认 160）
- `options.fallbackToBody`: 无摘要时是否提取纯文本正文（默认 `true`）

### `isArticleEncrypted(contentOrFrontmatter: string | Record<string, unknown>): boolean`

检测文章是否标记了加密（`encrypted: true` 或存在 `password`）。

### `chunkArticleForEmbedding(content: string, options?: ChunkOptions): string[]`

按标题和段落对 Markdown 正文进行结构感知切分。遇加密文章返回空数组 `[]`。

### `buildStaticSearchIndex(posts: PostWithAi[], options?: BuildSearchIndexOptions): SearchIndexItem[]`

将文章列表导出为轻量级全站静态搜索索引 JSON 结构。

---

### `class HyacineAiClient`

高层 AI 服务客户端。

#### 构造方法

```ts
new HyacineAiClient(options: HyacineSdkOptions)
```

#### 成员方法

- `getPostSummary(params: { hash: string; content?: string; model?: string }): Promise<SummaryResponse | null>`
- `getSimilarPosts(hash: string, options?: SimilarityOptions): Promise<SimilarItem[]>`
- `generateEmbeddings(params: { hash: string; content: string; model?: string; maxChunkSize?: number }): Promise<EmbedResponse | null>`
- `getAiStatus(hashes: string[]): Promise<AiStatusEntry[]>`
- `triggerGeneration(path: string, kinds?: ("summary" | "embed")[]): Promise<AiGenerateResponse>`
