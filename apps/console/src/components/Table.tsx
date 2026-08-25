import { splitProps, type JSX } from "solid-js";

export function TableContainer(props: { class?: string; children: JSX.Element }): JSX.Element {
  return (
    <div class={`surface overflow-auto border border-[var(--border)] rounded-[4px] ${props.class ?? ""}`}>
      {props.children}
    </div>
  );
}

export function Table(allProps: JSX.HTMLAttributes<HTMLTableElement>): JSX.Element {
  const [local, others] = splitProps(allProps, ["class", "children"]);
  return (
    <table class={`w-full text-left text-sm border-collapse ${local.class ?? ""}`} {...others}>
      {local.children}
    </table>
  );
}

export function TableHead(allProps: JSX.HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  const [local, others] = splitProps(allProps, ["class", "children"]);
  return (
    <thead
      class={`bg-[var(--g-2)] border-b border-[var(--border)] text-xs text-[var(--muted)] select-none uppercase tracking-wider ${
        local.class ?? ""
      }`}
      {...others}
    >
      {local.children}
    </thead>
  );
}

export function TableBody(allProps: JSX.HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  const [local, others] = splitProps(allProps, ["class", "children"]);
  return (
    <tbody class={`divide-y divide-[var(--border)]/70 ${local.class ?? ""}`} {...others}>
      {local.children}
    </tbody>
  );
}

export function TableRow(
  allProps: JSX.HTMLAttributes<HTMLTableRowElement> & { hoverable?: boolean },
): JSX.Element {
  const [local, others] = splitProps(allProps, ["class", "children", "hoverable"]);
  return (
    <tr
      class={`transition-colors ${
        local.hoverable !== false ? "hover:bg-[var(--g-1)]/80" : ""
      } ${local.class ?? ""}`}
      {...others}
    >
      {local.children}
    </tr>
  );
}

export function TableHeader(
  allProps: JSX.ThHTMLAttributes<HTMLTableCellElement>,
): JSX.Element {
  const [local, others] = splitProps(allProps, ["class", "children"]);
  return (
    <th class={`px-3.5 py-2.5 font-semibold text-xs ${local.class ?? ""}`} {...others}>
      {local.children}
    </th>
  );
}

export function TableCell(allProps: JSX.TdHTMLAttributes<HTMLTableCellElement>): JSX.Element {
  const [local, others] = splitProps(allProps, ["class", "children"]);
  return (
    <td class={`px-3.5 py-2.5 text-sm align-middle ${local.class ?? ""}`} {...others}>
      {local.children}
    </td>
  );
}
