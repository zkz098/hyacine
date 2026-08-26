import { Show, type JSX } from "solid-js";

export type AlertVariant = "error" | "info" | "success" | "warning" | "primary";

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  class?: string;
  icon?: boolean | string;
  children: JSX.Element;
}

const noteVars: Record<AlertVariant, { border: string; bg: string; text: string; icon: string }> = {
  primary: {
    border: "var(--note-primary-border)",
    bg: "var(--note-primary-bg)",
    text: "var(--note-primary-text)",
    icon: "i-ri-information-line",
  },
  info: {
    border: "var(--note-info-border)",
    bg: "var(--note-info-bg)",
    text: "var(--note-info-text)",
    icon: "i-ri-information-line",
  },
  success: {
    border: "var(--note-success-border)",
    bg: "var(--note-success-bg)",
    text: "var(--note-success-text)",
    icon: "i-ri-checkbox-circle-line",
  },
  warning: {
    border: "var(--note-warning-border)",
    bg: "var(--note-warning-bg)",
    text: "var(--note-warning-text)",
    icon: "i-ri-alert-line",
  },
  error: {
    border: "var(--note-danger-border)",
    bg: "var(--note-danger-bg)",
    text: "var(--note-danger-text)",
    icon: "i-ri-error-warning-line",
  },
};

/** ShokaX 风格提示条：左侧色条 + 语义底色/文字（复用 .note token） */
export function Alert(props: AlertProps): JSX.Element {
  const variant = (): AlertVariant => props.variant ?? "info";
  const v = (): (typeof noteVars)[AlertVariant] => noteVars[variant()];
  const showIcon = (): boolean => props.icon !== false;

  return (
    <div
      class={`px-3.5 py-2.5 rounded-[4px] text-sm border-l-4 flex items-start gap-2.5 ${props.class ?? ""}`}
      style={{
        "background-color": v().bg,
        "border-color": v().border,
        color: v().text,
      }}
      role="alert"
    >
      <Show when={showIcon()}>
        <span
          class={`${typeof props.icon === "string" ? props.icon : v().icon} text-base shrink-0 mt-0.5`}
        />
      </Show>
      <div class="flex-1 min-w-0">
        <Show when={props.title}>
          <div class="font-semibold text-xs mb-0.5">{props.title}</div>
        </Show>
        <div class="leading-relaxed">{props.children}</div>
      </div>
    </div>
  );
}
