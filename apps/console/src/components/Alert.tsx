import type { JSX } from "solid-js";

type Variant = "error" | "info" | "success" | "warning" | "primary";

interface Props {
  variant?: Variant;
  children: JSX.Element;
}

const noteVars: Record<Variant, { border: string; bg: string; text: string }> = {
  primary: {
    border: "var(--note-primary-border)",
    bg: "var(--note-primary-bg)",
    text: "var(--note-primary-text)",
  },
  info: {
    border: "var(--note-info-border)",
    bg: "var(--note-info-bg)",
    text: "var(--note-info-text)",
  },
  success: {
    border: "var(--note-success-border)",
    bg: "var(--note-success-bg)",
    text: "var(--note-success-text)",
  },
  warning: {
    border: "var(--note-warning-border)",
    bg: "var(--note-warning-bg)",
    text: "var(--note-warning-text)",
  },
  error: {
    border: "var(--note-danger-border)",
    bg: "var(--note-danger-bg)",
    text: "var(--note-danger-text)",
  },
};

/** ShokaX 风格提示条：左侧色条 + 语义底色/文字（复用 .note token） */
export function Alert(props: Props): JSX.Element {
  const variant = (): Variant => props.variant ?? "info";
  const v = (): { border: string; bg: string; text: string } => noteVars[variant()];
  return (
    <div
      class="px-3 py-2 rounded text-sm border-l-4"
      style={{
        "background-color": v().bg,
        "border-color": v().border,
        color: v().text,
      }}
    >
      {props.children}
    </div>
  );
}
