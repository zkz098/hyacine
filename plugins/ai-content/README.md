# @hyacine/plugin-ai-content

Hyacine 官方插件：AI 文章摘要卡片与相近文章推荐（构建期预计算，输出纯静态 HTML）。

- 渲染能力：`ssr`
- 注入插槽：
  - `post-summary`：AI 摘要卡片
  - `post-footer`：AI 相近文章推荐

## 使用

```ts
// hyacine.plugin.ts
import aiContent from "@hyacine/plugin-ai-content";

export default defineConfig({
  plugins: [
    aiContent({
      enable: true,
      aiSummary: {
        title: "AI 摘要",
        showModel: true,
      },
      aiRecommend: {
        limit: 3,
        minSimilarity: 0.4,
      },
    }),
  ],
});
```

主题侧（文章页）：

```astro
---
import HyacineOutlet from "@hyacine/plugin-astro/components/HyacineOutlet.astro";
const { post } = Astro.props;
---

<HyacineOutlet name="post-summary" context={post} extraProps={{ postId: post.id, postBody: post.body }} />
```

## 数据来源（优先级）

摘要（`resolvePostAiSummary`）：

1. SDK D1 Loader 注入的 `data.ai.summary`（云端 AI 图谱）
2. Frontmatter 物化值（`ai_summary` / `summary` / `aiSummary`）
3. 按需调用 Hyacine AI 网关（需 `extraProps.postId` + `postBody`，并配置 `apiUrl` 或 `HYACINE_API_URL` 环境变量）

相近文章（`resolvePostAiSimilar`）：

1. SDK 预计算注入的 `similarPosts`
2. 按需调用网关 `aiSimilar`（需 `postId`）

## 环境变量

- `HYACINE_API_URL`：网关地址（也可在插件 options 显式传入 `apiUrl`）
- `HYACINE_READ_TOKEN`：只读令牌（建议走环境变量，避免进入构建产物 JS）

## 加密文章

frontmatter 标记 `encrypted: true` 时组件自动短路不渲染。
