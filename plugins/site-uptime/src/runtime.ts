export interface SiteUptimeRuntimeOptions {
  siteCreatedAt: string;
  prefixText?: string;
  targetSelector?: string;
}

export function init(options: SiteUptimeRuntimeOptions): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const {
    siteCreatedAt,
    prefixText = "本站已持续运行",
    targetSelector = ".hyacine-slot-footer-status, .footer-status, #footer .status",
  } = options;

  const startDate = new Date(siteCreatedAt).getTime();
  if (Number.isNaN(startDate)) return;

  function update() {
    const el = document.querySelector(targetSelector);
    if (!el) return;

    let uptimeEl = el.querySelector(".hyacine-uptime-counter");
    if (!uptimeEl) {
      uptimeEl = document.createElement("span");
      uptimeEl.className = "hyacine-uptime-counter";
      el.appendChild(uptimeEl);
    }

    const diff = Math.max(0, Date.now() - startDate);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    uptimeEl.textContent = `${prefixText} ${days} 天 ${hours} 小时 ${minutes} 分 ${seconds} 秒`;
  }

  update();
  setInterval(update, 1000);
}

export default { init };
