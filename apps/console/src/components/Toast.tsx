import { createSignal, For, Show, type JSX } from "solid-js";
import { Portal } from "solid-js/web";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

const [toasts, setToasts] = createSignal<ToastItem[]>([]);

export const toast = {
  show(item: Omit<ToastItem, "id">): string {
    const id = Math.random().toString(36).slice(2, 9);
    const duration = item.duration ?? 3500;
    const newToast: ToastItem = { ...item, id, duration };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        toast.dismiss(id);
      }, duration);
    }
    return id;
  },
  success(message: string, title?: string): string {
    return toast.show({ type: "success", message, title });
  },
  error(message: string, title?: string): string {
    return toast.show({ type: "error", message, title, duration: 5000 });
  },
  info(message: string, title?: string): string {
    return toast.show({ type: "info", message, title });
  },
  warning(message: string, title?: string): string {
    return toast.show({ type: "warning", message, title, duration: 4500 });
  },
  dismiss(id: string): void {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  },
};

const toastConfig: Record<ToastType, { icon: string; border: string; bg: string; text: string }> = {
  success: {
    icon: "i-ri-checkbox-circle-line",
    border: "border-[var(--note-success-border)]",
    bg: "bg-[var(--note-success-bg)]",
    text: "text-[var(--note-success-text)]",
  },
  error: {
    icon: "i-ri-error-warning-line",
    border: "border-[var(--note-danger-border)]",
    bg: "bg-[var(--note-danger-bg)]",
    text: "text-[var(--note-danger-text)]",
  },
  info: {
    icon: "i-ri-information-line",
    border: "border-[var(--note-info-border)]",
    bg: "bg-[var(--note-info-bg)]",
    text: "text-[var(--note-info-text)]",
  },
  warning: {
    icon: "i-ri-alert-line",
    border: "border-[var(--note-warning-border)]",
    bg: "bg-[var(--note-warning-bg)]",
    text: "text-[var(--note-warning-text)]",
  },
};

export function ToastContainer(): JSX.Element {
  return (
    <Portal>
      <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-2 sm:px-0">
        <For each={toasts()}>
          {(t) => {
            const config = (): (typeof toastConfig)[ToastType] => toastConfig[t.type];
            return (
              <div
                class={`pointer-events-auto flex items-start gap-2.5 p-3 rounded-[6px] border shadow-lg backdrop-blur-md animate-fade-in ${
                  config().bg
                } ${config().border} ${config().text}`}
                role="alert"
              >
                <span class={`${config().icon} text-lg shrink-0 mt-0.5`} />
                <div class="flex-1 min-w-0">
                  <Show when={t.title}>
                    <p class="text-xs font-bold leading-tight mb-0.5">{t.title}</p>
                  </Show>
                  <p class="text-xs leading-relaxed break-words">{t.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toast.dismiss(t.id)}
                  class="shrink-0 p-0.5 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
                  aria-label="Dismiss toast"
                >
                  <span class="i-ri-close-line text-sm" />
                </button>
              </div>
            );
          }}
        </For>
      </div>
    </Portal>
  );
}
