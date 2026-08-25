import { Show, splitProps, type JSX } from "solid-js";

export interface InputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string | null;
  icon?: string | JSX.Element;
  trailing?: JSX.Element;
  inputClass?: string;
  containerClass?: string;
}

export function Input(allProps: InputProps): JSX.Element {
  const [local, others] = splitProps(allProps, [
    "label",
    "helperText",
    "error",
    "icon",
    "trailing",
    "class",
    "inputClass",
    "containerClass",
    "id",
  ]);

  return (
    <div class={`flex flex-col gap-1 text-sm ${local.containerClass ?? ""}`}>
      <Show when={local.label}>
        <label for={local.id} class="font-medium text-xs text-[var(--text)] flex items-center gap-1">
          {local.label}
        </label>
      </Show>
      <div class="relative flex items-center">
        <Show when={local.icon}>
          <div class="absolute left-3 text-[var(--muted)] pointer-events-none flex items-center">
            {typeof local.icon === "string" ? <span class={local.icon} /> : local.icon}
          </div>
        </Show>
        <input
          id={local.id}
          class={`w-full px-3 py-2 text-sm bg-[var(--bg)] border rounded-[4px] text-[var(--text)] placeholder:text-[var(--muted)] transition-colors focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 disabled:bg-[var(--g-2)] ${
            local.icon ? "pl-9" : ""
          } ${local.trailing ? "pr-10" : ""} ${
            local.error
              ? "border-[var(--danger)] focus:border-[var(--danger)]"
              : "border-[var(--border)]"
          } ${local.inputClass ?? ""} ${local.class ?? ""}`}
          {...others}
        />
        <Show when={local.trailing}>
          <div class="absolute right-3 flex items-center text-[var(--muted)]">
            {local.trailing}
          </div>
        </Show>
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
