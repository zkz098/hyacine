# @hyacine/plugin-article-statistics

Hyacine 官方插件：文章数据统计与 ECharts 可视化图表（ssr 注入 + 客户端水合）。

## 特性

- 封装 ECharts 折线图与柱状图（月度文章趋势、分类分布、标签词频）
- 支持主题 CSS Token 动态解析与暗色模式自适应
- 在 `article-statistics` 插槽中注入图表组件

## 安装与使用

```ts
import { defineConfig } from "@hyacine/plugin-core";
import articleStatistics from "@hyacine/plugin-article-statistics";

export default defineConfig({
  plugins: [articleStatistics()],
});
```

在 Astro 页面中使用：

```astro
<HyacineOutlet
  name="article-statistics"
  extraProps={{
    monthlyPostCounts: statistics.monthlyPostCounts,
    categoryCounts: statistics.categoryCounts,
    tagCounts: statistics.tagCounts,
  }}
/>
```
