import { For, Show, splitProps, type JSX } from "solid-js";

export interface SelectOption {
  label: string;
  value: string | number;
}

export interface SelectProps extends JSX.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string | null;
  options?: Array<SelectOption | string>;
  containerClass?: string;
  selectClass?: string;
  children?: JSX.Element;
}

export function Select(allProps: SelectProps): JSX.Element {
  const [local, others] = splitProps(allProps, [
    "label",
    "helperText",
    "error",
    "options",
    "containerClass",
    "selectClass",
    "class",
    "children",
    "id",
  ]);

  return (
    <div class={`flex flex-col gap-1 text-sm ${local.containerClass ?? ""}`}>
      <Show when={local.label}>
        <label
          for={local.id}
          class="font-medium text-xs text-[var(--text)] flex items-center gap-1"
        >
          {local.label}
        </label>
      </Show>
      <div class="relative flex items-center">
        <select
          id={local.id}
          value={others.value ?? ""}
          class={`w-full px-3 py-2 pr-8 text-sm bg-[var(--bg)] border rounded-[4px] text-[var(--text)] transition-colors focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 disabled:bg-[var(--g-2)] appearance-none cursor-pointer ${
            local.error
              ? "border-[var(--danger)] focus:border-[var(--danger)]"
              : "border-[var(--border)]"
          } ${local.selectClass ?? ""} ${local.class ?? ""}`}
          {...others}
        >
          <Show when={local.options}>
            <For each={local.options}>
              {(opt) => {
                const optVal = typeof opt === "string" ? opt : opt.value;
                const optLabel = typeof opt === "string" ? opt : opt.label;
                return (
                  <option
                    value={optVal}
                    selected={
                      others.value !== undefined && others.value !== null
                        ? String(optVal) === String(others.value)
                        : false
                    }
                  >
                    {optLabel}
                  </option>
                );
              }}
            </For>
          </Show>
          {local.children}
        </select>
        <div class="absolute right-2.5 pointer-events-none text-[var(--muted)] flex items-center">
          <span class="i-ri-arrow-down-s-line text-base" />
        </div>
      </div>
      <Show when={local.error}>
        <p class="text-xs text-[var(--danger)] mt-0.5">{local.error}</p>
      </Show>
      <Show when={!local.error && local.helperText}>
        <p class="text-xs text-[var(--muted)] mt-0.5">{local.helperText}</p>
      </Show>
    </div>
  );
}
