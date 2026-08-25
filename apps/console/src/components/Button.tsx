import { Show, splitProps, type JSX } from "solid-js";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: string | JSX.Element;
  trailingIcon?: string | JSX.Element;
  children?: JSX.Element;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:scale-[0.98] border border-transparent shadow-sm",
  secondary:
    "bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--g-2)] border border-[var(--border)] active:scale-[0.98]",
  outline:
    "bg-transparent text-[var(--text)] hover:bg-[var(--surface)] border border-[var(--border)] active:scale-[0.98]",
  ghost:
    "bg-transparent text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] border border-transparent active:scale-[0.98]",
  danger:
    "bg-[var(--note-danger-bg)] text-[var(--note-danger-text)] border border-[var(--note-danger-border)] hover:brightness-95 active:scale-[0.98]",
  success:
    "bg-[var(--note-success-bg)] text-[var(--note-success-text)] border border-[var(--note-success-border)] hover:brightness-95 active:scale-[0.98]",
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-xs gap-1 rounded-[3px]",
  sm: "px-2.5 py-1.5 text-xs font-medium gap-1.5 rounded-[4px]",
  md: "px-3.5 py-2 text-sm font-medium gap-2 rounded-[4px]",
  lg: "px-4 py-2.5 text-base font-medium gap-2.5 rounded-[6px]",
};

export function Button(allProps: ButtonProps): JSX.Element {
  const [local, others] = splitProps(allProps, [
    "variant",
    "size",
    "loading",
    "icon",
    "trailingIcon",
    "class",
    "children",
    "disabled",
    "type",
  ]);

  const variant = (): ButtonVariant => local.variant ?? "secondary";
  const size = (): ButtonSize => local.size ?? "sm";
  const isDisabled = (): boolean => local.disabled === true || local.loading === true;

  return (
    <button
      type={local.type ?? "button"}
      disabled={isDisabled()}
      class={`inline-flex items-center justify-center cursor-pointer select-none transition-all duration-150 shrink-0 font-sans disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${variantClasses[variant()]} ${sizeClasses[size()]} ${local.class ?? ""}`}
      {...others}
    >
      <Show when={local.loading}>
        <Spinner size={size() === "lg" ? "md" : size() === "xs" ? "xs" : "sm"} />
      </Show>
      <Show when={!local.loading && local.icon}>
        {typeof local.icon === "string" ? <span class={local.icon} /> : local.icon}
      </Show>
      {local.children}
      <Show when={!local.loading && local.trailingIcon}>
        {typeof local.trailingIcon === "string" ? (
          <span class={local.trailingIcon} />
        ) : (
          local.trailingIcon
        )}
      </Show>
    </button>
  );
}
