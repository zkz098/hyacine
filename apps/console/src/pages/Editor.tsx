// oxlint-disable typescript/no-unsafe-type-assertion, typescript/no-unnecessary-type-assertion, eslint/no-unused-vars
import { createEffect, createResource, createSignal, onMount, Show } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { parse as yamlParse } from "yaml";
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
import { loadEnabledPlugins } from "../editor/syntax/pluginSettings";
import { loadProjectSyntaxPlugins } from "../editor/syntax/projectPlugins";
import type { SyntaxPlugin } from "../editor/syntax/types";

type Mode = "split" | "source" | "preview";
type FmMode = "form" | "raw";
type SyncState = "offline" | "synced" | "unsynced";
const MODES: Mode[] = ["split", "source", "preview"];

const MODE_LABELS: Record<Mode, string> = {
  split: "分栏",
  source: "源码",
  preview: "预览",
};

/** 把 satteri 渲染出的 DOM 节点挂到容器里 */
function PreviewMount(props: {
  node: HTMLElement | null | undefined;
}): import("solid-js").JSX.Element {
  let container: HTMLDivElement | null = null;
  createEffect(() => {
    container?.replaceChildren();
    if (props.node !== null && props.node !== undefined) {
      container?.append(props.node);
    }
  });
  return (
    <div
      ref={(el) => {
        container = el;
      }}
      class="shokax-preview md min-h-[55vh] overflow-auto"
    />
  );
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

  // 完整 frontmatter 原文编辑（raw 模式）+ 保存/同步状态提示
  const [fmMode, setFmMode] = createSignal<FmMode>("form");
  const [fmRawText, setFmRawText] = createSignal("");
  const [dirty, setDirty] = createSignal(false);
  const [syncState, setSyncState] = createSignal<SyncState>("offline");
  const [syncingToApi, setSyncingToApi] = createSignal(false);

  // 视图模式：分栏 / 仅源码 / 仅预览
  const [mode, setMode] = createSignal<Mode>("split");
  // 预览用 satteri 渲染（与博客同管线）
  const isMdxFile = (): boolean => /\.mdx$/i.test(path());
  const [previewSrc, setPreviewSrc] = createSignal("");
  // 语法插件：启用列表（设置）+ 项目插件（.hyacine/plugins）
  const [enabledPlugins, setEnabledPlugins] = createSignal(loadEnabledPlugins());
  const [userPlugins, setUserPlugins] = createSignal<SyntaxPlugin[]>([]);  const [pluginsError, setPluginsError] = createSignal<string | null>(null);
  const [pluginRevision, setPluginRevision] = createSignal(0);
  const [previewNode] = createResource(
    () => [previewSrc(), pluginRevision()] as const,
    ([src]) =>
      renderPreview(src, isMdxFile(), {
        enabled: enabledPlugins(),
        plugins: userPlugins(),
      }),
  );

  const isPreviewBusy = (): boolean => previewNode.loading;

  let taEl: HTMLTextAreaElement | null = null;
  let debounceId: ReturnType<typeof setTimeout> | undefined;

  /** 输入防抖后刷新预览（300ms） */
  const handleSourceInput = (value: string): void => {
    setBody(value);
    setDirty(true);
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
      setFmRawText(parsed.matter);
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
      setDirty(false);
      setSyncState(apiStore.isAuthed() ? "unsynced" : "offline");
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
    // 设置页切换插件后返回：重建预览
    const onPluginsChanged = (): void => {
      setEnabledPlugins(loadEnabledPlugins());
      setPluginRevision((r) => r + 1);
    };
    window.addEventListener("hyacine:plugins-changed", onPluginsChanged);
    void resolveProjectPlugins();
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("hyacine:plugins-changed", onPluginsChanged);
    };
  });

  /** 读取项目级插件（.hyacine/plugins/*.js）并刷新预览 */
  const resolveProjectPlugins = async (): Promise<void> => {
    const dir = projectStore.projectDir();
    if (dir === null) return;
    try {
      const result = await loadProjectSyntaxPlugins(dir);
      setUserPlugins(result.plugins);
      if (result.errors.length > 0) {
        setPluginsError(`插件加载错误：${result.errors.join(" | ")}`);
      } else {
        setPluginsError(null);
      }
      setPluginRevision((r) => r + 1);
    } catch (e: unknown) {
      setPluginsError(e instanceof Error ? e.message : String(e));
    }
  };

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

  /** 完整文件文本（frontmatter + 正文），保存/上行共用 */
  const buildFullText = async (): Promise<{ out: string; data: Record<string, unknown> }> => {
    if (fmMode() === "raw") {
      // raw 模式：以原文 frontmatter 为准（保留任意扩展键，也可删键）
      const parsed: unknown = yamlParse(fmRawText(), { schema: "core" });
      const data =
        parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      const { stringifyFrontmatter } = await import("../lib/frontmatter");
      return { data, out: stringifyFrontmatter(data, body()) };
    }
    const data = buildFrontmatter();
    const { stringifyFrontmatter } = await import("../lib/frontmatter");
    return { data, out: stringifyFrontmatter(data, body()) };
  };

  /** 保存后（或按钮）把完整文件上行到 API（需登录；Primary 下自动触发 git 导出） */
  const syncToApi = async (fullText: string): Promise<void> => {
    if (!apiStore.isAuthed()) {
      setSyncState("offline");
      return;
    }
    const p = path();
    const fp = fullPath();
    if (p.length === 0 || fp === null) return;
    setSyncingToApi(true);
    try {
      const client = apiStore.getClient();
      await client.upsertPost({ path: p, content: fullText, source: "remote" });
      setSyncState("synced");
    } catch {
      setSyncState("unsynced");
    } finally {
      setSyncingToApi(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    const fp = fullPath();
    if (fp === null) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const { out } = await buildFullText();
      const finalOut = out.endsWith("\n") ? out : `${out}\n`;
      await writeTextFile(fp, finalOut);
      setDirty(false);
      setMsg(t("editor.saved"));
      await projectStore.refreshPosts();
      // 登录时自动上行，状态提示同步到 API 与否
      if (apiStore.isAuthed()) void syncToApi(finalOut);
      else setSyncState("offline");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async (): Promise<void> => {
    const fp = fullPath();
    if (fp === null) return;
    setErr(null);
    setMsg(null);
    try {
      const { out } = await buildFullText();
      const finalOut = out.endsWith("\n") ? out : `${out}\n`;
      await syncToApi(finalOut);
      if (syncState() === "synced") setMsg("已同步到 API");
    } catch (e: unknown) {
      setErr(messageOf(e));
    }
  };

  /** form ⇄ raw 切换：同步两边内容 */
  const switchFmMode = (next: FmMode): void => {
    if (next === fmMode()) return;
    if (next === "raw") {
      // 用当前表单数据序列化出 frontmatter 原文（body 置空仅取 fm 块）
      void import("../lib/frontmatter").then((m) => {
        setFmRawText(m.stringifyFrontmatter(buildFrontmatter(), ""));
      });
      setFmMode("raw");
    } else {
      try {
        const parsed: unknown = yamlParse(fmRawText(), { schema: "core" });
        const f =
          parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
        if (f !== null) {
          setFrontData(f);
          setTitle(typeof f.title === "string" ? f.title : "");
          setSlug(typeof f.slug === "string" ? f.slug : "");
          const cats = f.categories;
          if (Array.isArray(cats)) setCategories((cats as string[]).join(", "));
          else if (typeof cats === "string") setCategories(cats);
          else setCategories("");
          const tg = f.tags;
          if (Array.isArray(tg)) setTags((tg as string[]).join(", "));
          else if (typeof tg === "string") setTags(tg);
          else setTags("");
          setDraft(f.draft === true);
          setDate(typeof f.date === "string" ? f.date : "");
        }
      } catch {
        // raw 非法时保持原样，不覆盖表单
      }
      setFmMode("form");
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
      setFmRawText(reparsed.matter);
      // 摘要落地后同步源码与预览（修复"处理后不自动重渲染"）
      setSourceImmediate(reparsed.content);
      setDirty(false);
      setMsg(t("editor.aiDone"));
      await projectStore.refreshPosts();
      if (apiStore.isAuthed()) void syncToApi(updated.endsWith("\n") ? updated : `${updated}\n`);
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
          {/* 状态提示：本地保存 / API 同步 */}
          <span
            class={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${
              dirty()
                ? "text-[var(--warning)] border-[var(--note-warning-border)] bg-[var(--note-warning-bg)]"
                : "text-[var(--ok)] border-[var(--note-success-border)] bg-[var(--note-success-bg)]"
            }`}
          >
            <span class={dirty() ? "i-ri-close-circle-line" : "i-ri-check-double-line"} />
            {dirty() ? "本地：未保存" : "本地：已保存"}
          </span>
          <span
            class={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${
              syncState() === "synced"
                ? "text-[var(--ok)] border-[var(--note-success-border)] bg-[var(--note-success-bg)]"
                : syncState() === "offline"
                  ? "text-muted border-[var(--border)]"
                  : "text-[var(--warning)] border-[var(--note-warning-border)] bg-[var(--note-warning-bg)]"
            }`}
          >
            <span
              class={
                syncState() === "synced"
                  ? "i-ri-check-double-line"
                  : syncState() === "offline"
                    ? "i-ri-cloud-off-line"
                    : "i-ri-close-circle-line"
              }
            />
            {syncState() === "synced"
              ? "API：已同步"
              : syncState() === "offline"
                ? "API：未登录"
                : "API：未同步"}
          </span>
          <button
            type="button"
            onClick={() => void handleSyncNow()}
            disabled={syncingToApi() || !apiStore.isAuthed()}
            title="把当前文件单篇上行到 API（需登录）"
            class="px-3 py-1.5 rounded border border-[var(--border)] text-sm hover:bg-[var(--surface)] disabled:opacity-50"
          >
            <span class="i-ri-cloud-upload-line mr-1" />
            {syncingToApi() ? t("common.loading") : "同步到 API"}
          </button>
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
      <Show when={pluginsError() !== null}>
        <Alert variant="warning">{pluginsError()}</Alert>
      </Show>
      <Show when={msg() !== null}>
        <Alert variant="info">{msg()}</Alert>
      </Show>

      <Show when={raw() === null && path().length === 0}>
        <div class="surface p-8 flex flex-col items-center gap-3 text-center">
          <p class="text-sm text-muted">未打开任何文章 —— 请先在工作台选择一个项目并打开文章</p>
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
            <div class="flex items-center gap-1 rounded border border-[var(--border)] p-0.5 bg-[var(--surface)] w-fit">
              {(["form", "raw"] as FmMode[]).map((m) => (
                <button
                  type="button"
                  onClick={() => switchFmMode(m)}
                  class={`px-2.5 py-1 text-xs rounded ${
                    fmMode() === m
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {m === "form" ? "表单" : "原文"}
                </button>
              ))}
            </div>

            <Show when={fmMode() === "raw"}>
              <label class="flex flex-col gap-1 text-sm">
                <span class="text-muted">
                  frontmatter YAML 全文（可编辑任意键 / 增删一键，保存时解析）
                </span>
                <textarea
                  value={fmRawText()}
                  onInput={(e) => {
                    setFmRawText(e.currentTarget.value);
                    setDirty(true);
                  }}
                  spellcheck={false}
                  class="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-mono text-xs min-h-[30vh] resize-y"
                />
              </label>
            </Show>

            <Show when={fmMode() === "form"}>
              <label class="flex flex-col gap-1 text-sm">
                <span>标题</span>
                <input
                  value={title()}
                  onInput={(e) => {
                    setTitle(e.currentTarget.value);
                    setDirty(true);
                  }}
                  class="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                />
              </label>
              <label class="flex flex-col gap-1 text-sm">
                <span>slug</span>
                <input
                  value={slug()}
                  onInput={(e) => {
                    setSlug(e.currentTarget.value);
                    setDirty(true);
                  }}
                  class="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                />
              </label>
              <label class="flex flex-col gap-1 text-sm">
                <span>分类（逗号分隔）</span>
                <input
                  value={categories()}
                  onInput={(e) => {
                    setCategories(e.currentTarget.value);
                    setDirty(true);
                  }}
                  class="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                />
              </label>
              <label class="flex flex-col gap-1 text-sm">
                <span>标签（逗号分隔）</span>
                <input
                  value={tags()}
                  onInput={(e) => {
                    setTags(e.currentTarget.value);
                    setDirty(true);
                  }}
                  class="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                />
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft()}
                  onChange={(e) => {
                    setDraft(e.currentTarget.checked);
                    setDirty(true);
                  }}
                />
                <span>草稿</span>
              </label>
              <label class="flex flex-col gap-1 text-sm">
                <span>日期</span>
                <input
                  value={date()}
                  onInput={(e) => {
                    setDate(e.currentTarget.value);
                    setDirty(true);
                  }}
                  placeholder="2026-08-24"
                  class="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                />
              </label>
            </Show>
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <div class="flex items-center gap-1 rounded border border-[var(--border)] p-0.5 bg-[var(--surface)]">
                {MODES.map((m) => (
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
                mode() === "split" ? "grid grid-cols-1 xl:grid-cols-2 gap-2" : "flex flex-col gap-2"
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
