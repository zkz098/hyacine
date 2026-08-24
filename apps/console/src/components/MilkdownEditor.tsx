import { createEffect, onCleanup, onMount } from "solid-js";

interface Props {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
}

export function MilkdownEditor(props: Props): import("solid-js").JSX.Element {
  // oxlint-disable-next-line eslint/no-unassigned-vars -- SolidJS ref assigns via JSX
  let container!: HTMLDivElement;
  let editor: { destroy: () => void } | null = null;

  onMount(async () => {
    const { Editor, rootCtx, defaultValueCtx } = await import("@milkdown/core");
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

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrow to destroy handle
    editor = ed as unknown as { destroy: () => void };
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
