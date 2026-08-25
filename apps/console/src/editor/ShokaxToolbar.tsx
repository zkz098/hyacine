import { For, Show } from "solid-js";
import { SHOKAX_SNIPPETS } from "./shokaxSnippets";

interface Props {
  /** 编辑器可用于插入的 API；未就绪为空 */
  insertText: ((text: string) => void) | null;
}

/** ShokaX 常用语法插入工具栏：把 markdown/mdx 骨架写到光标处 */
export function ShokaxToolbar(props: Props): import("solid-js").JSX.Element {
  return (
    <div class="flex flex-wrap gap-1 items-center border border-[var(--border)] rounded p-1 bg-[var(--surface)]">
      <span class="px-1.5 text-xs text-[var(--muted)]">ShokaX</span>
      <Show when={props.insertText === null}>
        <span class="px-1 text-xs text-[var(--muted)]">(等待编辑器…)</span>
      </Show>
      <For each={SHOKAX_SNIPPETS}>
        {(s) => (
          <button
            type="button"
            title={s.label}
            onClick={() => {
              if (props.insertText !== null) props.insertText(s.build());
            }}
            disabled={props.insertText === null}
            class="px-2 py-1 rounded text-xs text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--text)] disabled:opacity-40"
          >
            <span class={`${s.icon} mr-1`} />
            {s.label}
          </button>
        )}
      </For>
    </div>
  );
}
