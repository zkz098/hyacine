import { Show, type JSX } from "solid-js";

export interface PageHeaderProps {
  title: string | JSX.Element;
  description?: string | JSX.Element;
  badge?: JSX.Element;
  actions?: JSX.Element;
  backHref?: string;
  backLabel?: string;
  class?: string;
}

export function PageHeader(props: PageHeaderProps): JSX.Element {
  return (
    <div
      class={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-[var(--border)]/60 ${
        props.class ?? ""
      }`}
    >
      <div class="flex flex-col gap-1 min-w-0">
        <Show when={props.backHref}>
          <a
            href={props.backHref ?? "#"}
            class="text-xs text-[var(--muted)] hover:text-[var(--text)] flex items-center gap-1 mb-1 transition-colors"
          >
            <span class="i-ri-arrow-left-line" />
            {props.backLabel ?? "返回"}
          </a>
        </Show>
        <div class="flex items-center gap-2.5 flex-wrap">
          <h1 class="text-xl font-bold tracking-tight text-[var(--text)]">{props.title}</h1>
          <Show when={props.badge}>{props.badge}</Show>
        </div>
        <Show when={props.description}>
          <p class="text-xs text-[var(--muted)] leading-relaxed">{props.description}</p>
        </Show>
      </div>
      <Show when={props.actions}>
        <div class="flex items-center gap-2 shrink-0 flex-wrap sm:self-center">{props.actions}</div>
      </Show>
    </div>
  );
}
