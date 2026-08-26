import { Show, type JSX } from "solid-js";
import { Card } from "./Card";

export interface EmptyStateProps {
  icon?: string | JSX.Element;
  title: string;
  description?: string | JSX.Element;
  action?: JSX.Element;
  class?: string;
}

export function EmptyState(props: EmptyStateProps): JSX.Element {
  return (
    <Card
      class={`p-8 sm:p-12 flex flex-col items-center justify-center text-center gap-3 border-dashed ${props.class ?? ""}`}
    >
      <Show when={props.icon}>
        <div class="w-12 h-12 rounded-full bg-[var(--g-2)] border border-[var(--border)] flex items-center justify-center text-2xl text-[var(--muted)] mb-1">
          {typeof props.icon === "string" ? <span class={props.icon} /> : props.icon}
        </div>
      </Show>
      <div class="flex flex-col gap-1 max-w-sm">
        <h4 class="text-sm font-semibold text-[var(--text)]">{props.title}</h4>
        <Show when={props.description}>
          <p class="text-xs text-[var(--muted)] leading-relaxed">{props.description}</p>
        </Show>
      </div>
      <Show when={props.action}>
        <div class="mt-2">{props.action}</div>
      </Show>
    </Card>
  );
}
