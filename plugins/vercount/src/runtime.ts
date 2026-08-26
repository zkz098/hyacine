export interface VercountOptions {
  apiBase?: string;
}

export function init(options: VercountOptions = {}): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = options.apiBase ? `${options.apiBase}/js` : "https://events.vercount.one/js";
  document.head.appendChild(script);
}

export default { init };
