import { type JSX, splitProps } from "solid-js";

export interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padded?: boolean;
  children: JSX.Element;
}

export function Card(allProps: CardProps): JSX.Element {
  const [local, others] = splitProps(allProps, ["hoverable", "padded", "class", "children"]);
  return (
    <div
      class={`surface ${local.padded !== false ? "p-4 sm:p-5" : ""} ${
        local.hoverable ? "cursor-pointer transition-transform hover:-translate-y-0.5" : ""
      } ${local.class ?? ""}`}
      {...others}
    >
      {local.children}
    </div>
  );
}

export function CardHeader(props: { class?: string; children: JSX.Element }): JSX.Element {
  return (
    <div class={`flex items-start justify-between gap-2 mb-3 ${props.class ?? ""}`}>
      {props.children}
    </div>
  );
}

export function CardTitle(props: { class?: string; children: JSX.Element }): JSX.Element {
  return (
    <h3 class={`text-sm font-semibold text-[var(--text)] tracking-tight ${props.class ?? ""}`}>
      {props.children}
    </h3>
  );
}

export function CardDescription(props: { class?: string; children: JSX.Element }): JSX.Element {
  return (
    <p class={`text-xs text-[var(--muted)] mt-0.5 leading-relaxed ${props.class ?? ""}`}>
      {props.children}
    </p>
  );
}

export function CardContent(props: { class?: string; children: JSX.Element }): JSX.Element {
  return <div class={`text-sm ${props.class ?? ""}`}>{props.children}</div>;
}

export function CardFooter(props: { class?: string; children: JSX.Element }): JSX.Element {
  return (
    <div
      class={`flex items-center justify-between gap-2 pt-3 mt-4 border-t border-[var(--border)] text-xs text-[var(--muted)] ${
        props.class ?? ""
      }`}
    >
      {props.children}
    </div>
  );
}
