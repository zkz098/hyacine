import { definePlugin, type PluginManifest } from "@hyacine/plugin-core";
import type { NyxPlayerPlaylist } from "./NyxPlayerWrapper";

export type { NyxPlayerPlaylist };

export interface NyxPlayerPluginOptions {
  /** 是否启用播放器，默认 true */
  enable?: boolean;
  /** 播放列表 */
  urls?: NyxPlayerPlaylist[];
  /** 播放器预设主题，默认 "shokax" */
  preset?: "nyx" | "shokax";
  /** 暗色模式匹配选择器，默认 ':root[data-theme="dark"]' */
  darkModeTarget?: string;
  /** Meting API 服务端根地址 */
  metingBaseURL?: string;
  /** 音频 URL 来源："outer"（默认外链直连）或 "proxy"（代理） */
  metingUrlSource?: "outer" | "proxy";
  /** 触发显示/隐藏播放器的按钮选择器，默认 "#nyx-show-btn" */
  showBtn?: string;
  /** 触发播放/暂停的按钮选择器，默认 "#nyx-play-btn" */
  playBtn?: string;
}

/**
 * NyxPlayer 音乐播放器插件。
 *
 * 以 ssr 形式在 `layout-bottom` 插槽渲染播放器容器，并在客户端以 `client:idle` 水合 Solid 组件。
 */
export function nyxPlayer(options: NyxPlayerPluginOptions = {}): PluginManifest {
  const enable = options.enable !== false && Boolean(options.urls && options.urls.length > 0);

  return definePlugin({
    name: "@hyacine/plugin-nyx-player",
    version: "0.1.0",
    minRenderCapability: "ssr",
    supportedPlatforms: ["astro"],
    entry: [
      {
        name: "nyx-player-ssr",
        type: "ssr",
        platform: "astro",
        injectPoint: "layout-bottom",
        path: new URL("./NyxPlayerPlugin.astro", import.meta.url).href,
        props: {
          enable,
          urls: options.urls ?? [],
          preset: options.preset ?? "shokax",
          darkModeTarget: options.darkModeTarget ?? ':root[data-theme="dark"]',
          metingBaseURL: options.metingBaseURL,
          metingUrlSource: options.metingUrlSource ?? "outer",
          showBtn: options.showBtn ?? "#nyx-show-btn",
          playBtn: options.playBtn ?? "#nyx-play-btn",
        },
      },
    ],
  });
}

export default nyxPlayer;
