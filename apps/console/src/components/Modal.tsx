import { createEffect, onCleanup, Show, type JSX } from "solid-js";
import { Portal } from "solid-js/web";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string | JSX.Element;
  description?: string | JSX.Element;
  size?: ModalSize;
  footer?: JSX.Element;
  children: JSX.Element;
  class?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[95vw] w-[95vw] h-[90vh]",
};

export function Modal(props: ModalProps): JSX.Element {
  const size = (): ModalSize => props.size ?? "md";

  createEffect(() => {
    if (!props.open) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        props.onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  return (
    <Show when={props.open}>
      <Portal>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          {/* Backdrop */}
          <div
            class="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => props.onClose()}
            aria-hidden="true"
          />

          {/* Modal Dialog */}
          <div
            role="dialog"
            aria-modal="true"
            class={`relative surface w-full rounded-[6px] shadow-2xl flex flex-col max-h-[90vh] z-10 animate-scale-in border border-[var(--border)] overflow-hidden ${
              sizeClasses[size()]
            } ${props.class ?? ""}`}
          >
            {/* Header */}
            <Show when={props.title}>
              <div class="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
                <div class="flex flex-col gap-0.5">
                  <h3 class="text-base font-semibold text-[var(--text)] tracking-tight">
                    {props.title}
                  </h3>
                  <Show when={props.description}>
                    <p class="text-xs text-[var(--muted)]">{props.description}</p>
                  </Show>
                </div>
                <button
                  type="button"
                  onClick={() => props.onClose()}
                  class="w-8 h-8 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--g-2)] transition-colors"
                  aria-label="Close dialog"
                >
                  <span class="i-ri-close-line text-lg" />
                </button>
              </div>
            </Show>

            {/* Content Body */}
            <div class="flex-1 p-5 overflow-y-auto">{props.children}</div>

            {/* Footer */}
            <Show when={props.footer}>
              <div class="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-[var(--g-1)] border-t border-[var(--border)] shrink-0">
                {props.footer}
              </div>
            </Show>
          </div>
        </div>
      </Portal>
    </Show>
  );
}
