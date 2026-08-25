import { createEffect, onCleanup, onMount } from "solid-js";

interface Props {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  /** 编辑器就绪后回调，用于在光标处插入 ShokaX 骨架文本 */
  onReady?: (api: { insertText: (text: string) => void }) => void;
}

interface EditorApi {
  destroy: () => void;
  insertText: (text: string) => void;
}

export function MilkdownEditor(props: Props): import("solid-js").JSX.Element {
  // oxlint-disable-next-line eslint/no-unassigned-vars -- SolidJS ref assigns via JSX
  let container!: HTMLDivElement;
  let editor: EditorApi | null = null;

  onMount(async () => {
    const { Editor, rootCtx, defaultValueCtx, editorViewCtx } = await import("@milkdown/core");
    const { commonmark } = await import("@milkdown/preset-commonmark");
    const { history } = await import("@milkdown/plugin-history");
    const { listener, listenerCtx } = await import("@milkdown/plugin-listener");
    const { nord } = await import("@milkdown/theme-nord");

    const ed = await Editor.make()
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- milkdown theme typing mismatch
      .config((ctx) => {
        ctx.set(rootCtx, container);
        ctx.set(defaultValueCtx, props.initialMarkdown);
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown: string, prev: string) => {
          if (markdown !== prev) props.onChange(markdown);
        });
      })
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- theme-nord typing mismatch, safe via any
      .use(nord as unknown as never)
      .use(commonmark)
      .use(history)
      .use(listener)
      .create();

    const handle: EditorApi = {
      destroy: () => {
        void ed.destroy();
      },
      // 在光标处插入字面量骨架文本（保存时原样写回 .mdx，交由 ShokaX 渲染）
      insertText: (text: string) => {
        ed.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const { state, dispatch } = view;
          dispatch(state.tr.insertText(text, state.selection.from, state.selection.to));
          view.focus();
        });
      },
    };

    editor = handle;
    props.onReady?.(handle);
  });

  createEffect(() => {
    void props.initialMarkdown;
  });

  onCleanup(() => {
    if (editor !== null) {
      try {
        editor.destroy();
      } catch {
        // ignore
      }
      editor = null;
    }
  });

  return (
    <div
      ref={container}
      class="milkdown-wrapper min-h-[300px] border border-[var(--border)] rounded p-2 bg-[var(--surface)]"
    />
  );
}
