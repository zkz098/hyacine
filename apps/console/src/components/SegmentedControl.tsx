import { For, Show, type JSX } from "solid-js";

export interface SegmentedItem<T extends string = string> {
  value: T;
  label: string | JSX.Element;
  icon?: string;
  count?: number;
}

export interface SegmentedControlProps<T extends string = string> {
  items: SegmentedItem<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "xs" | "sm" | "md";
  class?: string;
}

const sizeMap = {
  xs: "p-0.5 text-xs",
  sm: "p-0.5 text-xs",
  md: "p-1 text-sm",
};

const itemSizeMap = {
  xs: "px-2 py-0.5 gap-1",
  sm: "px-2.5 py-1 gap-1.5",
  md: "px-3 py-1.5 gap-2",
};

export function SegmentedControl<T extends string = string>(
  props: SegmentedControlProps<T>,
): JSX.Element {
  const size = (): "xs" | "sm" | "md" => props.size ?? "sm";

  return (
    <div
      class={`inline-flex items-center rounded-[6px] bg-[var(--g-2)] border border-[var(--border)] select-none ${
        sizeMap[size()]
      } ${props.class ?? ""}`}
    >
      <For each={props.items}>
        {(item) => {
          const isActive = (): boolean => props.value === item.value;
          return (
            <button
              type="button"
              onClick={() => props.onChange(item.value)}
              class={`inline-flex items-center justify-center font-medium rounded-[4px] transition-all cursor-pointer ${
                itemSizeMap[size()]
              } ${
                isActive()
                  ? "bg-[var(--surface)] text-[var(--text)] shadow-sm font-semibold"
                  : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--bg)]/50"
              }`}
            >
              <Show when={item.icon}>
                <span class={`${item.icon} text-sm`} />
              </Show>
              <span>{item.label}</span>
              <Show when={item.count !== undefined}>
                <span
                  class={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive()
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {item.count}
                </span>
              </Show>
            </button>
          );
        }}
      </For>
    </div>
  );
}
