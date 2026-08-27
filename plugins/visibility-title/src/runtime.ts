export interface VisibilityTitleRuntimeOptions {
  enable?: boolean;
  leaveTitle?: string;
  returnTitle?: string;
  restoreDelay?: number;
}

/**
 * 在客户端注册页面可见性变化监听器。
 */
export function init(options: VisibilityTitleRuntimeOptions = {}): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  if (options.enable === false) return;

  const leaveTitle = options.leaveTitle ?? "(╥﹏╥) 不要走嘛...";
  const returnTitle = options.returnTitle ?? "(๑•̀ㅂ•́)و✧ 欢迎回来！";
  const restoreDelay =
    typeof options.restoreDelay === "number" &&
    Number.isFinite(options.restoreDelay) &&
    options.restoreDelay >= 0
      ? options.restoreDelay
      : 3000;

  let originalTitle = document.title;
  let restoreTimer: number | undefined;

  const clearRestoreTimer = () => {
    if (restoreTimer !== undefined) {
      window.clearTimeout(restoreTimer);
      restoreTimer = undefined;
    }
  };

  const updateOriginalTitle = () => {
    if (!document.hidden) {
      originalTitle = document.title;
    }
  };

  const onVisibilityChange = () => {
    clearRestoreTimer();

    if (document.hidden) {
      originalTitle = document.title;
      document.title = leaveTitle;
      restoreTimer = window.setTimeout(() => {
        document.title = originalTitle;
      }, restoreDelay);
      return;
    }

    document.title = returnTitle;
    restoreTimer = window.setTimeout(() => {
      document.title = originalTitle;
    }, restoreDelay);
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  document.addEventListener("astro:page-load", updateOriginalTitle);
  document.addEventListener("astro:after-swap", updateOriginalTitle);
}

export default { init };
