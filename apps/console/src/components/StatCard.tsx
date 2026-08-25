import { Show, type JSX } from "solid-js";
import { Card } from "./Card";

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: string | JSX.Element;
  description?: string | JSX.Element;
  accentColor?: "accent" | "ok" | "warning" | "danger" | "info" | "primary";
  class?: string;
  onClick?: () => void;
}

const colorMap = {
  accent: {
    bg: "bg-[var(--c-pink-light)]",
    text: "text-[var(--accent)]",
    border: "border-[var(--accent)]/20",
  },
  ok: {
    bg: "bg-[var(--note-success-bg)]",
    text: "text-[var(--ok)]",
    border: "border-[var(--note-success-border)]",
  },
  warning: {
    bg: "bg-[var(--note-warning-bg)]",
    text: "text-[var(--note-warning-text)]",
    border: "border-[var(--note-warning-border)]",
  },
  danger: {
    bg: "bg-[var(--note-danger-bg)]",
    text: "text-[var(--danger)]",
    border: "border-[var(--note-danger-border)]",
  },
  info: {
    bg: "bg-[var(--note-info-bg)]",
    text: "text-[var(--note-info-text)]",
    border: "border-[var(--note-info-border)]",
  },
  primary: {
    bg: "bg-[var(--note-primary-bg)]",
    text: "text-[var(--note-primary-text)]",
    border: "border-[var(--note-primary-border)]",
  },
};

export function StatCard(props: StatCardProps): JSX.Element {
  const color = (): keyof typeof colorMap => props.accentColor ?? "accent";
  const colors = (): (typeof colorMap)[keyof typeof colorMap] => colorMap[color()];

  return (
    <Card
      hoverable={Boolean(props.onClick)}
      onClick={props.onClick}
      class={`flex flex-col justify-between relative overflow-hidden group ${props.class ?? ""}`}
    >
      <div class="flex items-center justify-between gap-2 mb-2">
        <span class="text-xs font-medium text-[var(--muted)]">{props.title}</span>
        <Show when={props.icon}>
          <div
            class={`w-8 h-8 rounded-lg flex items-center justify-center text-base border shrink-0 ${colors().bg} ${colors().text} ${colors().border}`}
          >
            {typeof props.icon === "string" ? <span class={props.icon} /> : props.icon}
          </div>
        </Show>
      </div>
      <div>
        <div class="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text)]">
          {props.value}
        </div>
        <Show when={props.description}>
          <div class="text-xs text-[var(--muted)] mt-1.5 flex items-center gap-1">
            {props.description}
          </div>
        </Show>
      </div>
    </Card>
  );
}
