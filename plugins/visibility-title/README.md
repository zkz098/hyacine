# @hyacine/plugin-visibility-title

Hyacine 官方插件：页面失焦/聚焦趣味标题切换（runtime-only）。

## 特性

- 离开标签页时展示提示文案（如 `(╥﹏╥) 不要走嘛...`）
- 返回标签页时展示欢迎文案（如 `(๑•̀ㅂ•́)و✧ 欢迎回来！`），并在设定的延迟后自动恢复原始标题
- 兼容 Astro View Transitions / 客户端 SPA 导航（`astro:page-load`、`astro:after-swap`）

## 安装与使用

```ts
import { defineConfig } from "@hyacine/plugin-core";
import visibilityTitle from "@hyacine/plugin-visibility-title";

export default defineConfig({
  plugins: [
    visibilityTitle({
      enable: true,
      leaveTitle: "(╥﹏╥) 不要走嘛...",
      returnTitle: "(๑•̀ㅂ•́)و✧ 欢迎回来！",
      restoreDelay: 3000,
    }),
  ],
});
```
