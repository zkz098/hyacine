import { definePlugin, type PluginManifest } from "@hyacine/plugin-core";

export interface VisibilityTitleOptions {
  /** 是否启用页面失焦/聚焦标题切换，默认 true */
  enable?: boolean;
  /** 离开标签页时显示的标题，默认为 "(╥﹏╥) 不要走嘛..." */
  leaveTitle?: string;
  /** 返回标签页时显示的标题，默认为 "(๑•̀ㅂ•́)و✧ 欢迎回来！" */
  returnTitle?: string;
  /** 返回后恢复原始标题的延迟（毫秒），默认 3000 */
  restoreDelay?: number;
}

/**
 * 页面失焦/聚焦趣味标题切换插件。
 *
 * 以 runtime-only 形式在客户端初始化，监听 document visibilitychange 事件切换网页标题。
 */
export function visibilityTitle(options: VisibilityTitleOptions = {}): PluginManifest {
  return definePlugin({
    name: "@hyacine/plugin-visibility-title",
    version: "0.1.0",
    minRenderCapability: "runtime-only",
    entry: [
      {
        name: "visibility-title-runtime",
        type: "runtime-only",
        injectPoint: "layout",
        path: new URL("./runtime.ts", import.meta.url).href,
        options: {
          enable: options.enable !== false,
          leaveTitle: options.leaveTitle,
          returnTitle: options.returnTitle,
          restoreDelay: options.restoreDelay,
        },
      },
    ],
  });
}

export default visibilityTitle;
