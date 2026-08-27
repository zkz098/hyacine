export interface GoogleAnalyticsRuntimeOptions {
  measurementId?: string;
}

export interface UmamiRuntimeOptions {
  websiteId?: string;
  scriptUrl?: string;
}

export interface AnalyticsRuntimeOptions {
  googleAnalytics?: GoogleAnalyticsRuntimeOptions;
  umami?: UmamiRuntimeOptions;
}

function appendHead(node: HTMLElement): void {
  document.head.appendChild(node);
}

/**
 * 在客户端注入 GA4 / Umami 统计脚本（等效于原来主题的 <head> is:inline 注入）。
 * - 两个服务均可选，配置为空时对应脚本不会注入。
 */
export function init(options: AnalyticsRuntimeOptions = {}): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const gaId = options.googleAnalytics?.measurementId?.trim();
  const umamiId = options.umami?.websiteId?.trim();

  if (!gaId && !umamiId) return;

  // ── Google Analytics 4 ────────────────────────────────────────────────
  if (gaId) {
    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = "https://www.googletagmanager.com";
    appendHead(preconnect);

    const gtagScript = document.createElement("script");
    gtagScript.async = true;
    gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    appendHead(gtagScript);

    // dataLayer/gtag 引导 + 首屏与 SPA 导航上报（astro:page-load）
    const inline = document.createElement("script");
    inline.textContent = `
      window.dataLayer = window.dataLayer || [];
      function gtag() { dataLayer.push(arguments); }
      gtag("js", new Date());
      gtag("config", ${JSON.stringify(gaId)}, { send_page_view: false });

      let lastTrackedPath = "";
      function trackPageView() {
        const path = location.pathname + location.search;
        if (path === lastTrackedPath) return;
        lastTrackedPath = path;
        gtag("event", "page_view", {
          page_title: document.title,
          page_location: location.href,
        });
      }

      if (document.readyState === "complete") {
        trackPageView();
      } else {
        window.addEventListener("load", trackPageView, { once: true });
      }
      document.addEventListener("astro:page-load", trackPageView);
    `;
    appendHead(inline);
  }

  // ── Umami ─────────────────────────────────────────────────────────────
  if (umamiId) {
    const scriptUrl = options.umami?.scriptUrl?.trim() || "https://cloud.umami.is/script.js";

    try {
      const origin = new URL(scriptUrl).origin;
      if (origin) {
        const preconnect = document.createElement("link");
        preconnect.rel = "preconnect";
        preconnect.href = origin;
        appendHead(preconnect);
      }
    } catch {
      // 忽略非法 scriptUrl，仍尝试注入
    }

    const umamiScript = document.createElement("script");
    umamiScript.defer = true;
    umamiScript.src = scriptUrl;
    umamiScript.dataset.websiteId = umamiId;
    appendHead(umamiScript);
  }
}

export default { init };
