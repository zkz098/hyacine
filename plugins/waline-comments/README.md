# @hyacine/plugin-waline-comments

Hyacine 官方插件：Waline 评论系统。

- 渲染能力：`ssr`
- 注入插槽：`comment`（主题显式声明 `<HyacineOutlet name="comment" />`）

## 使用

```ts
// hyacine.plugin.ts
import walineComments from "@hyacine/plugin-waline-comments";

export default defineConfig({
  plugins: [
    walineComments({
      serverURL: "https://comments.example.com",
      lang: "zh-CN",
      dark: ':root[data-theme="dark"]',
    }),
  ],
});
```

主题侧（如文章页、友链页评论区）添加：

```astro
---
import HyacineOutlet from "@hyacine/plugin-astro/components/HyacineOutlet.astro";
---

<div id="comments" class="comment">
  <HyacineOutlet name="comment" />
</div>
```

## 特性

- 构建期渲染容器（无需客户端水合框架），组件内 `<script>` 自举并调用 Waline `init()`。
- `path` 未配置时由 Waline 使用当前页 `location.pathname`。
- `serverURL` 未配置时组件不渲染（空插槽）。
