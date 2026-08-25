import { Show, type JSX } from "solid-js";

export type BadgeVariant = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
export type BadgeSize = "sm" | "md";

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  icon?: string | JSX.Element;
  class?: string;
  children: JSX.Element;
  title?: string;
}

const variantClasses: Record<BadgeVariant, { badge: string; dot: string }> = {
  neutral: {
    badge: "bg-[var(--g-2)] text-[var(--muted)] border-[var(--border)]",
    dot: "bg-[var(--muted)]",
  },
  primary: {
    badge: "bg-[var(--note-primary-bg)] text-[var(--note-primary-text)] border-[var(--note-primary-border)]",
    dot: "bg-[var(--note-primary-text)]",
  },
  success: {
    badge: "bg-[var(--note-success-bg)] text-[var(--note-success-text)] border-[var(--note-success-border)]",
    dot: "bg-[var(--ok)]",
  },
  warning: {
    badge: "bg-[var(--note-warning-bg)] text-[var(--note-warning-text)] border-[var(--note-warning-border)]",
    dot: "bg-[var(--c-orange)]",
  },
  danger: {
    badge: "bg-[var(--note-danger-bg)] text-[var(--note-danger-text)] border-[var(--note-danger-border)]",
    dot: "bg-[var(--danger)]",
  },
  info: {
    badge: "bg-[var(--note-info-bg)] text-[var(--note-info-text)] border-[var(--note-info-border)]",
    dot: "bg-[var(--note-info-text)]",
  },
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-1.5 py-0.5 text-[11px] gap-1",
  md: "px-2 py-0.5 text-xs gap-1.5",
};

export function Badge(props: BadgeProps): JSX.Element {
  const variant = (): BadgeVariant => props.variant ?? "neutral";
  const size = (): BadgeSize => props.size ?? "md";
  const styling = (): { badge: string; dot: string } => variantClasses[variant()];

  return (
    <span
      class={`inline-flex items-center font-medium border rounded-[4px] leading-tight shrink-0 transition-colors ${sizeClasses[size()]} ${styling().badge} ${props.class ?? ""}`}
      title={props.title}
    >
      <Show when={props.dot}>
        <span class={`w-1.5 h-1.5 rounded-full shrink-0 ${styling().dot}`} />
      </Show>
      <Show when={props.icon}>
        {typeof props.icon === "string" ? <span class={props.icon} /> : props.icon}
      </Show>
      {props.children}
    </span>
  );
}
