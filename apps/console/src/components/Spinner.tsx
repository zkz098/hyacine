import type { JSX } from "solid-js";

export interface SpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  class?: string;
}

const sizeClasses: Record<NonNullable<SpinnerProps["size"]>, string> = {
  xs: "w-3 h-3 border-[1.5px]",
  sm: "w-4 h-4 border-2",
  md: "w-5 h-5 border-2",
  lg: "w-8 h-8 border-3",
};

export function Spinner(props: SpinnerProps): JSX.Element {
  const size = (): NonNullable<SpinnerProps["size"]> => props.size ?? "sm";
  return (
    <div
      class={`inline-block rounded-full border-current border-t-transparent animate-spin-fast shrink-0 ${sizeClasses[size()]} ${props.class ?? ""}`}
      role="status"
      aria-label="loading"
    />
  );
}
