import { For, Show, type JSX } from "solid-js";

export interface TabItem {
  key: string;
  label: string | JSX.Element;
  icon?: string;
  count?: number;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  class?: string;
}

export function Tabs(props: TabsProps): JSX.Element {
  return (
    <div class={`flex items-center gap-1 border-b border-[var(--border)] overflow-x-auto ${props.class ?? ""}`}>
      <For each={props.items}>
        {(tab) => {
          const isActive = (): boolean => props.activeKey === tab.key;
          return (
            <button
              type="button"
              disabled={tab.disabled}
              onClick={() => props.onChange(tab.key)}
              class={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-b-2 -mb-[1px] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive()
                  ? "border-[var(--accent)] text-[var(--accent)] font-semibold"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border)]"
              }`}
            >
              <Show when={tab.icon}>
                <span class={`${tab.icon} text-sm`} />
              </Show>
              <span>{tab.label}</span>
              <Show when={tab.count !== undefined}>
                <span
                  class={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive()
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--g-3)] text-[var(--muted)]"
                  }`}
                >
                  {tab.count}
                </span>
              </Show>
            </button>
          );
        }}
      </For>
    </div>
  );
}
