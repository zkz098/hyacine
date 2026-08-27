# @hyacine/plugin-nyx-player

Hyacine 官方插件：NyxPlayer 音乐播放器集成（ssr 注入 + 客户端水合）。

## 特性

- 封装 `nyx-player-solid` 与 Modern Meting API 解析
- 支持在 `layout-bottom` 插槽挂载播放器
- 支持通过选择器（`showBtn` / `playBtn`）与主题工具栏按钮联动

## 安装与使用

```ts
import { defineConfig } from "@hyacine/plugin-core";
import nyxPlayer from "@hyacine/plugin-nyx-player";

export default defineConfig({
  plugins: [
    nyxPlayer({
      enable: true,
      urls: [
        {
          name: "精选歌单",
          url: "https://music.163.com/#/playlist?id=...",
        },
      ],
      preset: "shokax",
      metingBaseURL: "https://meting.api.zkz098.cn/",
      metingUrlSource: "outer",
    }),
  ],
});
```
