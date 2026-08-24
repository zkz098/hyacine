import type { JSX } from "solid-js";

interface Props {
  variant?: "error" | "info";
  children: JSX.Element;
}

export function Alert(props: Props): JSX.Element {
  const variant = (): string => props.variant ?? "info";
  return (
    <div
      class={`px-3 py-2 rounded text-sm border ${
        variant() === "error"
          ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300"
          : "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300"
      }`}
    >
      {props.children}
    </div>
  );
}
