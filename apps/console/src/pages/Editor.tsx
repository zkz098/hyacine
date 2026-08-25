import { createEffect, createResource, createSignal, onMount, Show } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { t } from "../i18n";
import { isTauri, readTextFile, writeTextFile } from "../tauri/bridge";
import { projectStore } from "../store/project";
import { parseFrontmatter, materializeSummary } from "../lib/frontmatter";
import { postBodyHash } from "../lib/postHash";
import { apiStore } from "../store/api";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";
import { ShokaxToolbar } from "../editor/ShokaxToolbar";
import { renderPreview } from "../editor/preview";

type Mode = "split" | "source" | "preview";

const MODE_LABELS: Record<Mode, string> = {
  split: "分栏",
  source: "源码",
  preview: "预览",
};

/** 把 satteri 渲染出的 DOM 节点挂到容器里 */
function PreviewMount(props: { node: HTMLElement | null | undefined }): import("solid-js").JSX.Element {
  let container!: HTMLDivElement;
  createEffect(() => {
    container.replaceChildren();
    if (props.node !== null && props.node !== undefined) {
      container.append(props.node);
    }
  });
  return <div ref={container} class="shokax-preview md min-h-[55vh] overflow-auto" />;
}

export function Editor(): import("solid-js").JSX.Element {
  const [searchParams] = useSearchParams();
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- searchParams typed as generic
  const path = (): string => (searchParams.path as string | undefined) ?? "";

  const [raw, setRaw] = createSignal<string | null>(null);
  const [frontData, setFrontData] = createSignal<Record<string, unknown>>({});
  const [body, setBody] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [aiLoading, setAiLoading] = createSignal(false);
  const [msg, setMsg] = createSignal<string | null>(null);
  const [err, setErr] = createSignal<string | null>(null);

  // 表单字段
  const [title, setTitle] = createSignal("");
  const [slug, setSlug] = createSignal("");
  const [categories, setCategories] = createSignal("");
  const [tags, setTags] = createSignal("");
  const [draft, setDraft] = createSignal(false);
  const [date, setDate] = createSignal("");

  // 视图模式：分栏 / 仅源码 / 仅预览
  const [mode, setMode] = createSignal<Mode>("split");
  // 预览用 satteri 渲染（与博客同管线）
  const isMdxFile = (): boolean => /\.mdx$/i.test(path());
  const [previewSrc, setPreviewSrc] = createSignal("");
  const [previewNode] = createResource(previewSrc, (md) => renderPreview(md, isMdxFile()));

  const isPreviewBusy = (): boolean => previewNode.loading;

  let taEl: HTMLTextAreaElement | null = null;
  let debounceId: ReturnType<typeof setTimeout> | undefined;

  /** 输入防抖后刷新预览（300ms） */
  const handleSourceInput = (value: string): void => {
    setBody(value);
    if (debounceId !== undefined) clearTimeout(debounceId);
    debounceId = setTimeout(() => setPreviewSrc(value), 300);
  };

  /** 工具栏 / 加载 / AI 摘要等外部变更立即刷新预览 */
  const setSourceImmediate = (value: string): void => {
    setPreviewSrc(value);
  };

  /** 在光标处插入 ShokaX 骨架文本 */
  const insertSnippet = (text: string): void => {
    const cur = body();
    const start = taEl?.selectionStart ?? cur.length;
    const end = taEl?.selectionEnd ?? start;
    const next = cur.slice(0, start) + text + cur.slice(end);
    setBody(next);
    setSourceImmediate(next);
    const pos = start + text.length;
    requestAnimationFrame(() => {
      taEl?.focus();
      taEl?.setSelectionRange(pos, pos);
    });
  };

  const fullPath = (): string | null => {
    const dir = projectStore.projectDir();
    const cfg = projectStore.projectConfig();
    const p = path();
    if (dir === null || cfg === null || p.length === 0) return null;
    return `${dir}/${cfg.contentDir}/${p}`;
  };

  const load = async (): Promise<void> => {
    const fp = fullPath();
    if (fp === null) return;
    try {
      const content = await readTextFile(fp);
      setRaw(content);
      const parsed = parseFrontmatter(content);
      setFrontData(parsed.data);
      setBody(parsed.content);
      setSourceImmediate(parsed.content);
      setTitle(typeof parsed.data.title === "string" ? parsed.data.title : "");
      setSlug(typeof parsed.data.slug === "string" ? parsed.data.slug : "");
      const cats = parsed.data.categories;
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- categories is string[] in frontmatter
      if (Array.isArray(cats)) setCategories((cats as string[]).join(", "));
      else if (typeof cats === "string") setCategories(cats);
      else setCategories("");
      const tg = parsed.data.tags;
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- tags is string[]
      if (Array.isArray(tg)) setTags((tg as string[]).join(", "));
      else if (typeof tg === "string") setTags(tg);
      else setTags("");
      setDraft(parsed.data.draft === true);
      setDate(typeof parsed.data.date === "string" ? parsed.data.date : "");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  onMount(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  createEffect(() => {
    // 当 path 变化重新加载（含首次）
    void path();
    void load();
  });

  const buildFrontmatter = (): Record<string, unknown> => {
    const data: Record<string, unknown> = { ...frontData() };
    data.title = title().trim() || data.title;
    if (slug().trim().length > 0) data.slug = slug().trim();
    const cats = categories()
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (cats.length > 0) data.categories = cats;
    else delete data.categories;
    const tg = tags()
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (tg.length > 0) data.tags = tg;
    else delete data.tags;
    data.draft = draft();
    if (date().trim().length > 0) data.date = date().trim();
    return data;
  };

  const handleSave = async (): Promise<void> => {
    const fp = fullPath();
    if (fp === null) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const data = buildFrontmatter();
      const { stringifyFrontmatter } = await import("../lib/frontmatter");
      const out = stringifyFrontmatter(data, body());
      await writeTextFile(fp, out.endsWith("\n") ? out : `${out}\n`);
      setMsg(t("editor.saved"));
      await projectStore.refreshPosts();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleAiSummary = async (): Promise<void> => {
    const fp = fullPath();
    if (fp === null) return;
    if (!apiStore.isAuthed()) {
      setErr(t("error.unauthorized"));
      return;
    }
    setAiLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const data = buildFrontmatter();
      const { stringifyFrontmatter } = await import("../lib/frontmatter");
      const full = stringifyFrontmatter(data, body());
      const hash = postBodyHash(full);
      const client = apiStore.getClient();
      const res = await client.aiSummary({ hash, content: full });
      const updated = materializeSummary(
        full,
        res.summary,
        res.model,
        res.sourceHash,
        new Date().toISOString(),
      );
      await writeTextFile(fp, updated);
      setRaw(updated);
      const reparsed = parseFrontmatter(updated);
      setFrontData(reparsed.data);
      setBody(reparsed.content);
      // 摘要落地后同步源码与预览（修复"处理后不自动重渲染"）
      setSourceImmediate(reparsed.content);
      setMsg(t("editor.aiDone"));
      await projectStore.refreshPosts();
    } catch (e: unknown) {
      setErr(messageOf(e));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div class="flex flex-col gap-4">
      <Show when={!isTauri()}>
        <Alert variant="info">{t("workspace.requireTauri")}</Alert>
      </Show>

      <div class="flex items-center gap-2">
        <a href="#/workspace" class="text-sm text-muted hover:text-[var(--text)]">
          ← {t("workspace.title")}
        </a>
        <span class="text-sm font-mono text-xs bg-[var(--surface)] border border-[var(--border)] px-2 py-1 rounded text-mono">
          {path() || "—"}
        </span>
        <div class="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => void handleAiSummary()}
            disabled={aiLoading() || raw() === null}
            class="px-3 py-1.5 rounded border border-[var(--border)] text-sm hover:bg-[var(--surface)] disabled:opacity-50"
          >
            <span class="i-ri-sparkling-line mr-1" />
            {aiLoading() ? t("editor.aiLoading") : t("editor.aiSummary")}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving() || raw() === null}
            class="px-4 py-1.5 rounded bg-[var(--accent)] text-white text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {saving() ? t("common.loading") : t("editor.save")}
          </button>
        </div>
      </div>

      <Show when={err() !== null}>
        <Alert variant="error">{err()}</Alert>
      </Show>
      <Show when={msg() !== null}>
        <Alert variant="info">{msg()}</Alert>
      </Show>

      <Show when={raw() === null && path().length === 0}>
        <div class="surface p-8 flex flex-col items-center gap-3 text-center">
          <p class="text-sm text-muted">
            未打开任何文章 —— 请先在工作台选择一个项目并打开文章
          </p>
          <a
            href="#/workspace"
            class="px-4 py-2 rounded bg-[var(--accent)] text-white text-sm hover:bg-[var(--accent-hover)]"
          >
            ← {t("workspace.title")}
          </a>
        </div>
      </Show>

      <Show when={raw() === null && path().length > 0}>
        <p class="text-sm text-muted">{t("common.loading")}</p>
      </Show>

      <Show when={raw() !== null}>
        <div class="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
          <div class="surface p-4 flex flex-col gap-3 h-fit">
            <h2 class="font-semibold text-sm">{t("editor.frontmatter")}</h2>
            <label class="flex flex-col gap-1 text-sm">
              <span>标题</span>
              <input
                value={title()}
                onInput={(e) => setTitle(e.currentTarget.value)}
                class="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
              />
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span>slug</span>
              <input
                value={slug()}
                onInput={(e) => setSlug(e.currentTarget.value)}
                class="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
              />
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span>分类（逗号分隔）</span>
              <input
                value={categories()}
                onInput={(e) => setCategories(e.currentTarget.value)}
                class="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
              />
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span>标签（逗号分隔）</span>
              <input
                value={tags()}
                onInput={(e) => setTags(e.currentTarget.value)}
                class="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
              />
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft()}
                onChange={(e) => setDraft(e.currentTarget.checked)}
              />
              <span>草稿</span>
            </label>
            <label class="flex flex-col gap-1 text-sm">
              <span>日期</span>
              <input
                value={date()}
                onInput={(e) => setDate(e.currentTarget.value)}
                placeholder="2026-08-24"
                class="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
              />
            </label>
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <div class="flex items-center gap-1 rounded border border-[var(--border)] p-0.5 bg-[var(--surface)]">
                {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
                  <button
                    type="button"
                    onClick={() => setMode(m)}
                    class={`px-2.5 py-1 text-xs rounded ${
                      mode() === m
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>
              <ShokaxToolbar insertText={insertSnippet} />
              {isPreviewBusy() ? (
                <span class="text-xs text-muted">{t("common.loading")}</span>
              ) : null}
              <Show when={previewNode.error}>
                <Alert variant="error">预览渲染失败：{messageOf(previewNode.error)}</Alert>
              </Show>
            </div>

            <div
              class={
                mode() === "split"
                  ? "grid grid-cols-1 xl:grid-cols-2 gap-2"
                  : "flex flex-col gap-2"
              }
            >
              {(mode() === "split" || mode() === "source") && (
                <textarea
                  ref={(el) => {
                    taEl = el;
                  }}
                  value={body()}
                  onInput={(e) => handleSourceInput(e.currentTarget.value)}
                  class="w-full min-h-[55vh] p-3 rounded border border-[var(--border)] bg-[var(--bg)] text-mono text-sm leading-relaxed resize-y focus:outline-none focus:border-[var(--accent)]"
                  spellcheck={false}
                  placeholder="Markdown / MDX 源码…"
                />
              )}
              {(mode() === "split" || mode() === "preview") && (
                <div class="surface p-4 rounded min-h-[55vh]">
                  <PreviewMount node={previewNode()} />
                </div>
              )}
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}