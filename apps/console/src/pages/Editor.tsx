// oxlint-disable typescript/no-unsafe-type-assertion, typescript/no-unnecessary-type-assertion, eslint/no-unused-vars
import { createEffect, createResource, createSignal, onMount, Show, For } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { parse as yamlParse } from "yaml";
import { t } from "../i18n";
import { isTauri, readTextFile, writeTextFile } from "../tauri/bridge";
import { projectStore } from "../store/project";
import { parseFrontmatter, materializeSummary } from "../lib/frontmatter";
import { postBodyHash } from "../lib/postHash";
import { getCollections, type Collection, type CollectionFieldUi } from "@hyacine/contract";
import { apiStore } from "../store/api";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { SegmentedControl } from "../components/SegmentedControl";
import { Spinner } from "../components/Spinner";
import { toast } from "../components/Toast";
import { ShokaxToolbar } from "../editor/ShokaxToolbar";
import { renderPreview } from "../editor/preview";
import { loadEnabledPlugins } from "../editor/syntax/pluginSettings";
import { loadProjectSyntaxPlugins } from "../editor/syntax/projectPlugins";
import type { SyntaxPlugin } from "../editor/syntax/types";

type Mode = "split" | "source" | "preview";
type FmMode = "form" | "raw";
type SyncState = "offline" | "synced" | "unsynced";

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
      class="shokax-preview md min-h-[60vh] overflow-auto p-4 leading-relaxed"
    />
  );
}

export function Editor(): import("solid-js").JSX.Element {
  const [searchParams] = useSearchParams();
  const path = (): string => (searchParams.path as string | undefined) ?? "";

  const [raw, setRaw] = createSignal<string | null>(null);
  const [frontData, setFrontData] = createSignal<Record<string, unknown>>({});
  const [body, setBody] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [aiLoading, setAiLoading] = createSignal(false);
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
  const isMdxFile = (): boolean => /\.mdx$/i.test(path());
  const [previewSrc, setPreviewSrc] = createSignal("");
  const [enabledPlugins, setEnabledPlugins] = createSignal(loadEnabledPlugins());
  const [userPlugins, setUserPlugins] = createSignal<SyntaxPlugin[]>([]);
  const [pluginsError, setPluginsError] = createSignal<string | null>(null);
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

  const handleSourceInput = (value: string): void => {
    setBody(value);
    setDirty(true);
    if (debounceId !== undefined) clearTimeout(debounceId);
    debounceId = setTimeout(() => setPreviewSrc(value), 300);
  };

  const setSourceImmediate = (value: string): void => {
    setPreviewSrc(value);
  };

  const insertSnippet = (text: string): void => {
    const cur = body();
    const start = taEl?.selectionStart ?? cur.length;
    const end = taEl?.selectionEnd ?? start;
    const next = cur.slice(0, start) + text + cur.slice(end);
    setBody(next);
    setDirty(true);
    setSourceImmediate(next);
    const pos = start + text.length;
    requestAnimationFrame(() => {
      taEl?.focus();
      taEl?.setSelectionRange(pos, pos);
    });
  };

  const fullPath = (): string | null => {
    const dir = projectStore.projectDir();
    const p = path();
    if (dir === null || p.length === 0) return null;
    return `${dir}/${p}`;
  };

  const currentCollection = (): Collection | null => {
    const cfg = projectStore.projectConfig();
    const cf = projectStore.collectionsFile();
    const p = path();
    if (cfg === null || cf === null || p.length === 0) return null;
    const spec = getCollections(cfg).find((s) => p === s.dir || p.startsWith(`${s.dir}/`));
    const name = spec?.name ?? "posts";
    return cf.collections.find((c) => c.name === name) ?? null;
  };

  const CORE_FIELDS = new Set(["title", "slug", "categories", "tags", "draft", "date"]);
  const extraFields = (): CollectionFieldUi[] => {
    const c = currentCollection();
    if (c === null) return [];
    return c.ui.fields.filter(
      (f) =>
        !CORE_FIELDS.has(f.key) &&
        (f.kind === "string" ||
          f.kind === "date" ||
          f.kind === "boolean" ||
          f.kind === "enum" ||
          f.kind === "string[]"),
    );
  };

  const [extras, setExtras] = createSignal<Record<string, string>>({});

  const seedExtras = (data: Record<string, unknown>): void => {
    const next: Record<string, string> = {};
    for (const f of extraFields()) {
      const v = data[f.key];
      if (v === undefined || v === null) continue;
      if (f.kind === "boolean") next[f.key] = v === true ? "true" : "false";
      else if (Array.isArray(v)) next[f.key] = v.join(", ");
      else next[f.key] = String(v);
    }
    setExtras(next);
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
      if (Array.isArray(cats)) setCategories((cats as string[]).join(", "));
      else if (typeof cats === "string") setCategories(cats);
      else setCategories("");
      const tg = parsed.data.tags;
      if (Array.isArray(tg)) setTags((tg as string[]).join(", "));
      else if (typeof tg === "string") setTags(tg);
      else setTags("");
      setDraft(parsed.data.draft === true);
      setDate(typeof parsed.data.date === "string" ? parsed.data.date : "");
      seedExtras(parsed.data);
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

  const buildFullText = async (): Promise<{ out: string; data: Record<string, unknown> }> => {
    if (fmMode() === "raw") {
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
    try {
      const { out } = await buildFullText();
      const finalOut = out.endsWith("\n") ? out : `${out}\n`;
      await writeTextFile(fp, finalOut);
      setDirty(false);
      toast.success(title() || path(), "文章已保存");
      await projectStore.refreshPosts();
      if (apiStore.isAuthed()) void syncToApi(finalOut);
      else setSyncState("offline");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      toast.error(e instanceof Error ? e.message : String(e), "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async (): Promise<void> => {
    const fp = fullPath();
    if (fp === null) return;
    setErr(null);
    try {
      const { out } = await buildFullText();
      const finalOut = out.endsWith("\n") ? out : `${out}\n`;
      await syncToApi(finalOut);
      if (syncState() === "synced") toast.success("文章已同步至云端 API");
    } catch (e: unknown) {
      setErr(messageOf(e));
      toast.error(messageOf(e), "同步失败");
    }
  };

  const switchFmMode = (next: FmMode): void => {
    if (next === fmMode()) return;
    if (next === "raw") {
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
          seedExtras(f);
        }
      } catch {
        // raw 非法时保持原样
      }
      setFmMode("form");
    }
  };

  const renderExtraField = (f: CollectionFieldUi): import("solid-js").JSX.Element => {
    const value = (): string => extras()[f.key] ?? "";
    const set = (v: string): void => {
      setExtras({ ...extras(), [f.key]: v });
      setDirty(true);
    };
    const label = (): string => `${f.key}${f.required ? " *" : ""}`;

    if (f.kind === "enum") {
      return (
        <Select
          label={label()}
          value={value()}
          onChange={(e) => set(e.currentTarget.value)}
          options={[{ label: "—", value: "" }, ...(f.values ?? []).map((v) => ({ label: v, value: v }))]}
        />
      );
    }
    if (f.kind === "boolean") {
      return (
        <label class="flex items-center gap-2 text-xs font-medium cursor-pointer py-1">
          <input
            type="checkbox"
            checked={value() === "true"}
            onChange={(e) => set(e.currentTarget.checked ? "true" : "")}
            class="rounded text-[var(--accent)]"
          />
          <span>{f.key}</span>
        </label>
      );
    }
    return (
      <Input
        label={label()}
        type={f.secret === true ? "password" : "text"}
        value={value()}
        onInput={(e) => set(e.currentTarget.value)}
        placeholder={
          f.secret === true
            ? "（不回显）"
            : f.image === true
              ? "图片路径（src/assets/...）"
              : f.kind === "date"
                ? "YYYY-MM-DD"
                : ""
        }
      />
    );
  };

  const handleAiSummary = async (): Promise<void> => {
    const fp = fullPath();
    if (fp === null) return;
    if (!apiStore.isAuthed()) {
      setErr(t("error.unauthorized"));
      toast.warning("需要先连接 API 云端才能生成 AI 摘要");
      return;
    }
    setAiLoading(true);
    setErr(null);
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
      setSourceImmediate(reparsed.content);
      setDirty(false);
      toast.success(t("editor.aiDone"));
      await projectStore.refreshPosts();
      if (apiStore.isAuthed()) void syncToApi(updated.endsWith("\n") ? updated : `${updated}\n`);
    } catch (e: unknown) {
      setErr(messageOf(e));
      toast.error(messageOf(e), "生成摘要失败");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div class="flex flex-col gap-4">
      <Show when={!isTauri()}>
        <Alert variant="info">{t("workspace.requireTauri")}</Alert>
      </Show>

      {/* Editor Top Bar */}
      <div class="surface p-3 border border-[var(--border)] rounded-[6px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div class="flex items-center gap-2 flex-wrap">
          <a
            href="#/workspace"
            class="text-xs font-medium text-[var(--muted)] hover:text-[var(--text)] flex items-center gap-1 transition-colors"
          >
            <span class="i-ri-arrow-left-line" />
            {t("workspace.title")}
          </a>
          <span class="text-[var(--border)]">/</span>
          <span class="font-mono text-xs bg-[var(--g-1)] border border-[var(--border)] px-2 py-0.5 rounded-[4px] text-[var(--text)] truncate max-w-xs">
            {path() || "未指定文章"}
          </span>

          <Badge variant={dirty() ? "warning" : "success"} size="sm" dot>
            {dirty() ? "未保存" : "已保存"}
          </Badge>

          <Badge
            variant={syncState() === "synced" ? "success" : syncState() === "offline" ? "neutral" : "warning"}
            size="sm"
            dot
          >
            {syncState() === "synced"
              ? "API 已同步"
              : syncState() === "offline"
                ? "API 离线"
                : "API 待同步"}
          </Badge>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            loading={syncingToApi()}
            disabled={!apiStore.isAuthed() || raw() === null}
            icon="i-ri-cloud-upload-line"
            onClick={() => void handleSyncNow()}
            title="把当前文件单篇上行到 API"
          >
            同步到 API
          </Button>

          <Button
            variant="secondary"
            size="sm"
            loading={aiLoading()}
            disabled={raw() === null}
            icon="i-ri-sparkling-line"
            onClick={() => void handleAiSummary()}
          >
            {aiLoading() ? t("editor.aiLoading") : t("editor.aiSummary")}
          </Button>

          <Button
            variant="primary"
            size="sm"
            loading={saving()}
            disabled={raw() === null}
            icon="i-ri-save-line"
            onClick={() => void handleSave()}
          >
            {saving() ? t("common.loading") : `${t("editor.save")} (Ctrl+S)`}
          </Button>
        </div>
      </div>

      <Show when={err() !== null}>
        <Alert variant="error" title="错误提示">
          {err()}
        </Alert>
      </Show>

      <Show when={pluginsError() !== null}>
        <Alert variant="warning" title="插件提示">
          {pluginsError()}
        </Alert>
      </Show>

      {/* When no post is selected */}
      <Show when={raw() === null && path().length === 0}>
        <Card class="p-12 flex flex-col items-center justify-center text-center gap-3">
          <span class="i-ri-quill-pen-line text-4xl text-[var(--muted)]" />
          <h3 class="text-sm font-semibold">未打开任何文章</h3>
          <p class="text-xs text-[var(--muted)]">请先在工作台中选择一篇文章或创建新文章</p>
          <a href="#/workspace">
            <Button variant="primary" size="sm" icon="i-ri-folder-open-line">
              前往工作台
            </Button>
          </a>
        </Card>
      </Show>

      {/* Editor Main Grid */}
      <Show when={raw() !== null}>
        <div class="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 items-start">
          {/* Frontmatter Sidebar */}
          <Card class="flex flex-col gap-3">
            <div class="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <span class="font-semibold text-xs text-[var(--text)] uppercase tracking-wider">
                {t("editor.frontmatter")}
              </span>
              <SegmentedControl<FmMode>
                value={fmMode()}
                onChange={switchFmMode}
                size="xs"
                items={[
                  { value: "form", label: "表单" },
                  { value: "raw", label: "YAML" },
                ]}
              />
            </div>

            <Show when={fmMode() === "raw"}>
              <div class="flex flex-col gap-1.5">
                <span class="text-[11px] text-[var(--muted)]">
                  YAML 原文（可增删修改任意属性，保存时自动解析）
                </span>
                <textarea
                  value={fmRawText()}
                  onInput={(e) => {
                    setFmRawText(e.currentTarget.value);
                    setDirty(true);
                  }}
                  spellcheck={false}
                  class="w-full p-2.5 rounded-[4px] border border-[var(--border)] bg-[var(--bg)] font-mono text-xs min-h-[45vh] resize-y focus:outline-none focus:border-[var(--accent)] leading-relaxed"
                />
              </div>
            </Show>

            <Show when={fmMode() === "form"}>
              <div class="flex flex-col gap-3">
                <Input
                  label="文章标题"
                  value={title()}
                  onInput={(e) => {
                    setTitle(e.currentTarget.value);
                    setDirty(true);
                  }}
                  placeholder="文章标题"
                />

                <Input
                  label="Slug"
                  value={slug()}
                  onInput={(e) => {
                    setSlug(e.currentTarget.value);
                    setDirty(true);
                  }}
                  placeholder="post-slug"
                />

                <Input
                  label="分类 (逗号分隔)"
                  value={categories()}
                  onInput={(e) => {
                    setCategories(e.currentTarget.value);
                    setDirty(true);
                  }}
                  placeholder="技术, 前端"
                />

                <Input
                  label="标签 (逗号分隔)"
                  value={tags()}
                  onInput={(e) => {
                    setTags(e.currentTarget.value);
                    setDirty(true);
                  }}
                  placeholder="solidjs, shokax"
                />

                <Input
                  label="发布日期"
                  value={date()}
                  onInput={(e) => {
                    setDate(e.currentTarget.value);
                    setDirty(true);
                  }}
                  placeholder="YYYY-MM-DD"
                />

                <label class="flex items-center gap-2 text-xs font-medium cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={draft()}
                    onChange={(e) => {
                      setDraft(e.currentTarget.checked);
                      setDirty(true);
                    }}
                    class="rounded text-[var(--accent)]"
                  />
                  <span>设为草稿 (Draft)</span>
                </label>

                <Show when={extraFields().length > 0}>
                  <div class="border-t border-[var(--border)] pt-3 mt-1 flex flex-col gap-2.5">
                    <span class="text-[11px] font-semibold text-[var(--muted)]">
                      扩展字段 (Astro Schema)
                    </span>
                    <For each={extraFields()}>{(f) => renderExtraField(f)}</For>
                  </div>
                </Show>
              </div>
            </Show>
          </Card>

          {/* Right Main Editor & Preview Workspace */}
          <div class="flex flex-col gap-3">
            {/* Editor Toolbar */}
            <div class="surface p-2.5 border border-[var(--border)] rounded-[6px] flex flex-wrap items-center justify-between gap-2 shadow-xs">
              <div class="flex items-center gap-2 flex-wrap">
                <SegmentedControl<Mode>
                  value={mode()}
                  onChange={setMode}
                  size="xs"
                  items={[
                    { value: "split", label: "分栏", icon: "i-ri-layout-column-line" },
                    { value: "source", label: "源码", icon: "i-ri-code-line" },
                    { value: "preview", label: "预览", icon: "i-ri-eye-line" },
                  ]}
                />
                <div class="h-4 w-px bg-[var(--border)] mx-1" />
                <ShokaxToolbar insertText={insertSnippet} />
              </div>

              <Show when={isPreviewBusy()}>
                <div class="flex items-center gap-1.5 text-xs text-[var(--muted)] pr-2">
                  <Spinner size="xs" />
                  <span>渲染预览中...</span>
                </div>
              </Show>
            </div>

            <Show when={previewNode.error}>
              <Alert variant="error" title="预览渲染失败">
                {messageOf(previewNode.error)}
              </Alert>
            </Show>

            {/* Split / Source / Preview Container */}
            <div
              class={
                mode() === "split"
                  ? "grid grid-cols-1 xl:grid-cols-2 gap-3"
                  : "flex flex-col gap-3"
              }
            >
              {(mode() === "split" || mode() === "source") && (
                <div class="surface border border-[var(--border)] rounded-[6px] overflow-hidden flex flex-col shadow-xs">
                  <div class="px-3 py-1.5 bg-[var(--g-1)] border-b border-[var(--border)] text-[11px] font-mono text-[var(--muted)] flex items-center justify-between select-none">
                    <span>Markdown / MDX 源码</span>
                    <span>{body().length} 字符</span>
                  </div>
                  <textarea
                    ref={(el) => {
                      taEl = el;
                    }}
                    value={body()}
                    onInput={(e) => handleSourceInput(e.currentTarget.value)}
                    class="w-full min-h-[62vh] p-4 bg-[var(--bg)] font-mono text-xs sm:text-sm leading-relaxed resize-y focus:outline-none focus:ring-0 text-[var(--text)] selection:bg-[var(--accent)] selection:text-white"
                    spellcheck={false}
                    placeholder="开始书写 Markdown / MDX 精彩内容..."
                  />
                </div>
              )}

              {(mode() === "split" || mode() === "preview") && (
                <div class="surface border border-[var(--border)] rounded-[6px] overflow-hidden flex flex-col shadow-xs">
                  <div class="px-3 py-1.5 bg-[var(--g-1)] border-b border-[var(--border)] text-[11px] font-mono text-[var(--muted)] flex items-center justify-between select-none">
                    <span>ShokaX 实时预览 (Satteri)</span>
                    <span class="text-[10px] text-[var(--ok)]">✓ 已同步渲染</span>
                  </div>
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
