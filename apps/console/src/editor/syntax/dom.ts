// oxlint-disable typescript/no-unsafe-type-assertion, typescript/no-base-to-string, eslint/no-underscore-dangle, eslint/no-unused-vars
import type { Props } from "./types";

/** DOM 舞台共享工具：jsx 运行时与组件渲染器共用（全部只依赖 DOM API） */

export function flattenChildren(children: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const c of children) {
    if (Array.isArray(c)) out.push(...flattenChildren(c));
    else out.push(c);
  }
  return out;
}

export function normalizeChildren(p: Props): unknown[] {
  const children = p.children;
  if (children === undefined || children === null) return [];
  return Array.isArray(children) ? flattenChildren(children) : [children];
}

export function appendChild(parent: Node, child: unknown): void {
  if (child === null || child === undefined || child === false || child === true) return;
  if (typeof child === "string" || typeof child === "number") {
    parent.appendChild(document.createTextNode(String(child)));
  } else if (child instanceof Node) {
    parent.appendChild(child);
  }
}

export function setProps(node: Element, p: Props): void {
  for (const [k, v] of Object.entries(p)) {
    if (k === "children" || k === "key") continue;
    if (v === null || v === undefined || v === false) continue;
    if (k === "className") node.setAttribute("class", String(v));
    else if (k === "dangerouslySetInnerHTML" && typeof v === "object" && v !== null) {
      node.innerHTML = String((v as { __html?: unknown }).__html ?? "");
    } else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (typeof v === "object") {
      node.setAttribute(k, JSON.stringify(v));
    } else {
      node.setAttribute(k, String(v));
    }
  }
}

export function wrap<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  p: Props,
  extra?: (node: HTMLElementTagNameMap[K]) => void,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className.length > 0) node.className = className;
  extra?.(node);
  for (const c of normalizeChildren(p)) appendChild(node, c);
  return node;
}
