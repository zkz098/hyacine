import { createResource, createSignal, For, Show, onMount } from "solid-js";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { Modal } from "../components/Modal";
import { EmptyState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
import { SegmentedControl } from "../components/SegmentedControl";
import {
  TableContainer,
  Table,
  TableHead,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from "../components/Table";
import { toast } from "../components/Toast";
import { renderPreview } from "../editor/preview";
import { loadEnabledPlugins } from "../editor/syntax/pluginSettings";
import { parseFrontmatter } from "../lib/frontmatter";
import { PreviewMount } from "./Editor";

type FilterStatus = "all" | "published" | "draft" | "has_ai" | "no_ai";

/** repo 相对路径 → 集合目录名（src/posts → posts）；根部文件显示 — */
function dirLabel(path: string): string {
  const parts = path.split("/");
  const dir = parts.slice(0, -1).join("/");
  if (dir.length === 0) return "—";
  return dir.replace(/^src\//, "") || dir;
}

export function Posts(): import("solid-js").JSX.Element {
  const [filter, setFilter] = createSignal("");
  const [statusFilter, setStatusFilter] = createSignal<FilterStatus>("all");
  const [categoryFilter, setCategoryFilter] = createSignal("");

  const [posts, { refetch }] = createResource(async () => {
    const client = apiStore.getClient();
    const res = await client.postsList();
    return res.posts;
  });

  // 多选与删除状态
  const [selectedPaths, setSelectedPaths] = createSignal<string[]>([]);
  const [deleting, setDeleting] = createSignal(false);
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);
  const [pathsToDelete, setPathsToDelete] = createSignal<string[]>([]);

  const isSelected = (path: string): boolean => selectedPaths().includes(path);
  const toggleSelect = (path: string): void => {
    if (isSelected(path)) {
      setSelectedPaths(selectedPaths().filter((p) => p !== path));
    } else {
      setSelectedPaths([...selectedPaths(), path]);
    }
  };
  const toggleSelectAll = (visiblePaths: string[]): void => {
    if (visiblePaths.every((p) => selectedPaths().includes(p))) {
      setSelectedPaths(selectedPaths().filter((p) => !visiblePaths.includes(p)));
    } else {
      const next = new Set([...selectedPaths(), ...visiblePaths]);
      setSelectedPaths(Array.from(next));
    }
  };
  const clearSelection = (): void => {
    setSelectedPaths([]);
  };

  const promptDeleteSingle = (path: string): void => {
    setPathsToDelete([path]);
    setShowDeleteModal(true);
  };

  const promptDeleteBatch = (): void => {
    if (selectedPaths().length === 0) return;
    setPathsToDelete([...selectedPaths()]);
    setShowDeleteModal(true);
  };

  const confirmDelete = async (): Promise<void> => {
    const targets = pathsToDelete();
    if (targets.length === 0) return;
    setDeleting(true);
    try {
      const res = await apiStore.getClient().deletePosts({ paths: targets });
      toast.success(`已成功从云端下架删除 ${res.deletedCount} 篇文章`, "云端文章已删除");
      setSelectedPaths(selectedPaths().filter((p) => !targets.includes(p)));
      setShowDeleteModal(false);
      await refetch();
    } catch (err: unknown) {
      toast.error(messageOf(err), "删除云端文章失败");
    } finally {
      setDeleting(false);
    }
  };

  // 远程编辑 / 查看模式
  type ModalViewMode = "preview" | "source" | "split";
  const [modalMode, setModalMode] = createSignal<ModalViewMode>("preview");
  const [editingPath, setEditingPath] = createSignal<string | null>(null);
  const [editContent, setEditContent] = createSignal("");
  const [editLoading, setEditLoading] = createSignal(false);
  const [editSaving, setEditSaving] = createSignal(false);
  const [editError, setEditError] = createSignal<string | null>(null);

  const isMdxFile = (): boolean => (editingPath() ?? "").endsWith(".mdx");
  const previewSource = (): string => {
    const c = editContent();
    if (!c) return "";
    try {
      return parseFrontmatter(c).content;
    } catch {
      return c;
    }
  };

  const [previewNode] = createResource(
    () => [previewSource(), isMdxFile()] as const,
    ([src, isMdx]) =>
      renderPreview(src, isMdx, {
        enabled: loadEnabledPlugins(),
      }),
  );

  // 立刻生成摘要/嵌入
  const [generatingPath, setGeneratingPath] = createSignal<string | null>(null);
  const [genMsg, setGenMsg] = createSignal<{ kind: "ok" | "err"; text: string } | null>(null);
  // 模式与可写性（Gateway 模式支持完整读写；Replica 模式为只读副本）
  const [serverMode, setServerMode] = createSignal<"gateway" | "replica">("gateway");
  const [primaryAvailable, setPrimaryAvailable] = createSignal(false);
  onMount(() => {
    void apiStore
      .getClient()
      .health()
      .then((h) => {
        const isReplica = h.mode === "replica" || h.primary?.available === false;
        setServerMode(isReplica ? "replica" : "gateway");
        setPrimaryAvailable(!isReplica);
      })
      .catch(() => {
        setServerMode("gateway");
        setPrimaryAvailable(true);
      });
  });

  const handleGenerateAi = async (post: { path: string; title: string }): Promise<void> => {
    setGeneratingPath(post.path);
    setGenMsg(null);
    try {
      const res = await apiStore
        .getClient()
        .generateAi({ path: post.path, kinds: ["summary", "embed"] });
      const parts = [
        `${t("posts.ai.summary")}: ${res.summary.present ? t("posts.ai.present") : "—"}`,
        `${t("posts.ai.embed")}: ${res.embed.present ? t("posts.ai.present") : "—"}`,
      ];
      if (res.errors.length > 0) {
        const msg = `${post.title} → ${parts.join(" · ")}；${res.errors.join("；")}`;
        setGenMsg({ kind: "err", text: msg });
        toast.warning(msg);
      } else {
        const msg = `${post.title} → ${parts.join(" · ")}`;
        setGenMsg({ kind: "ok", text: msg });
        toast.success(msg, "AI 产物已生成");
      }
      await refetch();
    } catch (err: unknown) {
      const msg = `${post.title}：${messageOf(err)}`;
      setGenMsg({ kind: "err", text: msg });
      toast.error(msg, "生成 AI 失败");
    } finally {
      setGeneratingPath(null);
    }
  };

  const openEdit = async (path: string): Promise<void> => {
    setEditingPath(path);
    setEditError(null);
    setEditLoading(true);
    setModalMode(primaryAvailable() ? "split" : "preview");
    try {
      const res = await apiStore.getClient().getPostContent(path);
      setEditContent(res.content);
    } catch (err: unknown) {
      setEditError(messageOf(err));
      toast.error(messageOf(err), "无法读取文章正文");
    } finally {
      setEditLoading(false);
    }
  };

  const saveEdit = async (): Promise<void> => {
    if (!primaryAvailable()) {
      toast.warning("Replica 模式为只读副本，禁止在云端保存修改");
      return;
    }
    const path = editingPath();
    if (path === null) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await apiStore.getClient().upsertPost({ path, content: editContent() });
      const msg = res.changed ? "正文已更新至 D1 数据库" : "正文无变化";
      toast.success(msg, "保存成功");
      setEditingPath(null);
      await refetch();
    } catch (err: unknown) {
      setEditError(messageOf(err));
      toast.error(messageOf(err), "保存文章失败");
    } finally {
      setEditSaving(false);
    }
  };

  // 获取所有分类列表
  const allCategories = (): string[] => {
    const list = posts();
    if (!list) return [];
    const cats = new Set<string>();
    for (const p of list) {
      if (Array.isArray(p.categories)) {
        for (const c of p.categories) cats.add(c);
      }
    }
    return Array.from(cats);
  };

  const filtered = (): ReturnType<typeof posts> => {
    const list = posts();
    if (list === undefined) return undefined;
    const f = filter().toLowerCase().trim();
    const st = statusFilter();
    const cat = categoryFilter();

    return list.filter((p) => {
      // 文本搜索
      const matchText =
        f.length === 0 ||
        p.title.toLowerCase().includes(f) ||
        p.slug.toLowerCase().includes(f) ||
        p.path.toLowerCase().includes(f);
      if (!matchText) return false;

      // 状态过滤
      if (st === "published" && p.draft) return false;
      if (st === "draft" && !p.draft) return false;
      if (st === "has_ai" && !p.ai.summary.present && !p.ai.embed.present) return false;
      if (st === "no_ai" && p.ai.summary.present && p.ai.embed.present) return false;

      // 分类过滤
      if (cat.length > 0 && (!p.categories || !p.categories.includes(cat))) return false;

      return true;
    });
  };

  return (
    <div class="flex flex-col gap-6">
      <PageHeader
        title={t("posts.title")}
        description="管理云端 D1 数据库中的文章索引与 AI 摘要/嵌入产物"
        badge={
          <Show when={posts()}>
            <Badge variant="neutral">共 {posts()?.length ?? 0} 篇文章</Badge>
          </Show>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            loading={posts.loading}
            icon="i-ri-refresh-line"
            onClick={() => void refetch()}
          >
            {t("posts.refresh")}
          </Button>
        }
      />

      <Show when={posts.error}>
        <Alert variant="error" title="读取文章列表失败">
          {messageOf(posts.error)}
        </Alert>
      </Show>

      <Show when={genMsg()}>
        {(m) => <Alert variant={m().kind === "ok" ? "success" : "warning"}>{m().text}</Alert>}
      </Show>

      {/* Filter and Search Bar */}
      <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[var(--surface)] p-3 border border-[var(--border)] rounded-[6px]">
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          <Input
            value={filter()}
            onInput={(e) => setFilter(e.currentTarget.value)}
            placeholder={t("posts.filter")}
            icon="i-ri-search-line"
            containerClass="max-w-xs flex-1"
          />

          <Show when={allCategories().length > 0}>
            <Select
              value={categoryFilter()}
              onChange={(e) => setCategoryFilter(e.currentTarget.value)}
              containerClass="w-36"
              options={[
                { label: "全部分类", value: "" },
                ...allCategories().map((c) => ({ label: c, value: c })),
              ]}
            />
          </Show>
        </div>

        <SegmentedControl<FilterStatus>
          value={statusFilter()}
          onChange={setStatusFilter}
          size="sm"
          items={[
            { value: "all", label: "全部" },
            { value: "published", label: "已发布" },
            { value: "draft", label: "草稿" },
            { value: "has_ai", label: "已生成AI" },
          ]}
        />
      </div>

      <Show when={posts.loading}>
        <div class="p-12 flex flex-col items-center justify-center gap-3 text-[var(--muted)]">
          <Spinner size="md" />
          <span class="text-xs">{t("common.loading")}</span>
        </div>
      </Show>

      {/* Batch Selection Action Bar */}
      <Show when={selectedPaths().length > 0}>
        <div class="flex items-center justify-between p-2.5 bg-[var(--g-2)] border border-[var(--border)] rounded-[6px] text-xs shadow-xs">
          <div class="flex items-center gap-2">
            <span class="i-ri-checkbox-circle-fill text-base text-[var(--accent)]" />
            <span class="font-medium text-[var(--text)]">
              {t("workspace.selectedCount", { count: String(selectedPaths().length) })}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="xs" onClick={clearSelection}>
              {t("workspace.clearSelection")}
            </Button>
            <Button
              variant="danger"
              size="xs"
              icon="i-ri-delete-bin-line"
              onClick={promptDeleteBatch}
            >
              {t("posts.batchDelete")}
            </Button>
          </div>
        </div>
      </Show>

      {/* Posts Table */}
      <Show when={filtered()}>
        {(list) => (
          <Show
            when={list().length > 0}
            fallback={
              <EmptyState
                icon="i-ri-article-line"
                title={posts()?.length === 0 ? t("posts.empty") : "无匹配文章"}
                description={
                  posts()?.length === 0
                    ? "可以通过本地工作区或 CLI 工具同步文章到云端"
                    : "请尝试调整搜索关键字或筛选条件"
                }
              />
            }
          >
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow hoverable={false}>
                    <TableHeader class="w-[4%]">
                      <input
                        type="checkbox"
                        checked={
                          list().length > 0 && list().every((p) => selectedPaths().includes(p.path))
                        }
                        onChange={() => toggleSelectAll(list().map((p) => p.path))}
                        class="rounded text-[var(--accent)] cursor-pointer"
                        aria-label="全选"
                      />
                    </TableHeader>
                    <TableHeader class="w-[26%]">标题与路径</TableHeader>
                    <TableHeader class="w-[10%]">集合</TableHeader>
                    <TableHeader class="w-[13%]">Slug</TableHeader>
                    <TableHeader class="w-[10%]">状态</TableHeader>
                    <TableHeader class="w-[11%]">分类</TableHeader>
                    <TableHeader class="w-[12%]">AI 产物</TableHeader>
                    <TableHeader class="w-[14%] text-right">操作</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <For each={list()}>
                    {(post) => (
                      <TableRow>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={isSelected(post.path)}
                            onChange={() => toggleSelect(post.path)}
                            class="rounded text-[var(--accent)] cursor-pointer"
                            aria-label={`选择文章 ${post.title}`}
                          />
                        </TableCell>

                        <TableCell>
                          <div class="flex flex-col gap-0.5">
                            <span class="font-medium text-[var(--text)]" title={post.hash}>
                              {post.title}
                            </span>
                            <span class="text-[11px] font-mono text-[var(--muted)] truncate max-w-xs">
                              {post.path}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="neutral" size="sm">
                            {dirLabel(post.path)}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <span class="font-mono text-xs text-[var(--muted)]">{post.slug}</span>
                        </TableCell>

                        <TableCell>
                          {post.draft ? (
                            <Badge variant="warning" size="sm" dot>
                              草稿
                            </Badge>
                          ) : (
                            <Badge variant="success" size="sm" dot>
                              已发布
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell>
                          <div class="flex flex-wrap gap-1">
                            <For each={post.categories}>
                              {(cat) => (
                                <span class="text-[11px] text-[var(--muted)] bg-[var(--g-2)] px-1.5 py-0.5 rounded-[3px]">
                                  {cat}
                                </span>
                              )}
                            </For>
                            <Show when={!post.categories || post.categories.length === 0}>
                              <span class="text-xs text-[var(--muted)]">—</span>
                            </Show>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div class="flex items-center gap-1.5 text-xs">
                            <span
                              class={`inline-flex items-center gap-0.5 ${
                                post.ai.summary.present
                                  ? "text-[var(--ok)] font-medium"
                                  : "text-[var(--muted)]"
                              }`}
                              title={
                                post.ai.summary.model ? `模型: ${post.ai.summary.model}` : "未生成"
                              }
                            >
                              <span
                                class={
                                  post.ai.summary.present
                                    ? "i-ri-checkbox-circle-fill"
                                    : "i-ri-close-circle-line"
                                }
                              />
                              摘要
                            </span>
                            <span class="text-[var(--border)]">/</span>
                            <span
                              class={`inline-flex items-center gap-0.5 ${
                                post.ai.embed.present
                                  ? "text-[var(--ok)] font-medium"
                                  : "text-[var(--muted)]"
                              }`}
                              title={
                                post.ai.embed.model ? `模型: ${post.ai.embed.model}` : "未生成"
                              }
                            >
                              <span
                                class={
                                  post.ai.embed.present
                                    ? "i-ri-checkbox-circle-fill"
                                    : "i-ri-close-circle-line"
                                }
                              />
                              嵌入
                            </span>
                          </div>
                        </TableCell>

                        <TableCell class="text-right">
                          <div class="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="xs"
                              loading={generatingPath() === post.path}
                              disabled={generatingPath() !== null}
                              onClick={() => void handleGenerateAi(post)}
                              icon={
                                generatingPath() === post.path ? undefined : "i-ri-sparkling-line"
                              }
                              title="生成摘要与向量嵌入"
                            >
                              {generatingPath() === post.path
                                ? t("posts.ai.generating")
                                : t("posts.ai.generate")}
                            </Button>

                            <Button
                              variant={primaryAvailable() ? "secondary" : "outline"}
                              size="xs"
                              onClick={() => void openEdit(post.path)}
                              icon={primaryAvailable() ? "i-ri-edit-line" : "i-ri-eye-line"}
                              title={
                                primaryAvailable()
                                  ? "在线编辑正文"
                                  : t("posts.replicaReadOnlyTooltip")
                              }
                            >
                              {primaryAvailable() ? t("posts.editRemote") : t("posts.viewReadOnly")}
                            </Button>

                            <Button
                              variant="ghost"
                              size="xs"
                              class="text-[var(--danger)] hover:bg-[var(--danger)]/10"
                              icon="i-ri-delete-bin-line"
                              onClick={() => promptDeleteSingle(post.path)}
                              title={t("posts.delete")}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </For>
                </TableBody>
              </Table>
            </TableContainer>
          </Show>
        )}
      </Show>

      {/* Remote Edit / View Modal */}
      <Modal
        open={editingPath() !== null}
        onClose={() => setEditingPath(null)}
        title={
          primaryAvailable()
            ? `编辑文章：${editingPath() ?? ""}`
            : `${t("posts.viewTitle")}：${editingPath() ?? ""}`
        }
        description={
          primaryAvailable()
            ? "修改将直接保存至 Cloudflare D1 边缘数据库"
            : "当前为 Replica 模式（本地事实源），正文仅供查看与预览，请在本地修改后同步"
        }
        size="full"
        footer={
          <div class="flex items-center justify-between w-full">
            <div class="text-xs text-[var(--muted)]">
              <Show when={!primaryAvailable()}>
                <span class="flex items-center gap-1 text-[var(--warning)] font-medium">
                  <span class="i-ri-lock-line" />
                  只读模式（禁止保存）
                </span>
              </Show>
            </div>
            <div class="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingPath(null)}>
                {primaryAvailable() ? "取消" : "关闭"}
              </Button>
              <Show when={primaryAvailable()}>
                <Button
                  variant="primary"
                  size="sm"
                  loading={editSaving()}
                  onClick={() => void saveEdit()}
                  icon="i-ri-save-line"
                >
                  {editSaving() ? t("posts.editing") : t("posts.editSave")}
                </Button>
              </Show>
            </div>
          </div>
        }
      >
        <div class="flex flex-col gap-3 h-full">
          {/* Top mode switcher toolbar */}
          <div class="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-[var(--border)] shrink-0">
            <SegmentedControl<ModalViewMode>
              value={modalMode()}
              onChange={setModalMode}
              size="xs"
              items={[
                { value: "preview", label: "渲染预览", icon: "i-ri-eye-line" },
                { value: "source", label: "Markdown 源码", icon: "i-ri-code-line" },
                { value: "split", label: "分栏对照", icon: "i-ri-layout-column-line" },
              ]}
            />
            <Show when={previewNode.loading}>
              <div class="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <Spinner size="xs" />
                <span>渲染中...</span>
              </div>
            </Show>
          </div>

          <Show when={!primaryAvailable()}>
            <Alert variant="info" title="只读模式 (Replica)">
              {t("posts.replicaReadOnlyNotice")}
            </Alert>
          </Show>

          <Show when={editError() !== null}>
            <Alert variant="error">{editError()}</Alert>
          </Show>

          <Show when={editLoading()}>
            <div class="p-12 flex items-center justify-center gap-2 text-[var(--muted)]">
              <Spinner size="sm" />
              <span>{t("common.loading")}</span>
            </div>
          </Show>

          <Show when={!editLoading()}>
            <div
              class={`flex-1 min-h-0 ${
                modalMode() === "split"
                  ? "grid grid-cols-1 lg:grid-cols-2 gap-3"
                  : "flex flex-col gap-3"
              }`}
            >
              {(modalMode() === "split" || modalMode() === "source") && (
                <div class="flex flex-col rounded-[6px] border border-[var(--border)] bg-[var(--bg)] overflow-hidden shadow-xs h-[58vh]">
                  <div class="px-3 py-1.5 bg-[var(--g-1)] border-b border-[var(--border)] text-[11px] font-mono text-[var(--muted)] flex items-center justify-between select-none shrink-0">
                    <span>Markdown / MDX 源码 {primaryAvailable() ? "" : "（只读）"}</span>
                    <span>{editContent().length} 字符</span>
                  </div>
                  <textarea
                    value={editContent()}
                    onInput={(e) => {
                      if (primaryAvailable()) {
                        setEditContent(e.currentTarget.value);
                      }
                    }}
                    readOnly={!primaryAvailable()}
                    spellcheck={false}
                    class={`w-full flex-1 p-3.5 text-xs sm:text-sm font-mono leading-relaxed resize-none overflow-y-auto focus:outline-none ${
                      primaryAvailable()
                        ? "bg-[var(--bg)] focus:border-[var(--accent)]"
                        : "bg-[var(--g-1)] text-[var(--text)] cursor-default select-text"
                    }`}
                    placeholder="文章 Markdown / MDX 源码..."
                  />
                </div>
              )}

              {(modalMode() === "split" || modalMode() === "preview") && (
                <div class="flex flex-col rounded-[6px] border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-xs h-[58vh]">
                  <div class="px-3 py-1.5 bg-[var(--g-1)] border-b border-[var(--border)] text-[11px] font-mono text-[var(--muted)] flex items-center justify-between select-none shrink-0">
                    <span>ShokaX 渲染结果 (Satteri)</span>
                    <span class="text-[10px] text-[var(--ok)]">✓ 已渲染</span>
                  </div>
                  <Show when={previewNode.error}>
                    <div class="p-3">
                      <Alert variant="error" title="渲染失败">
                        {messageOf(previewNode.error)}
                      </Alert>
                    </div>
                  </Show>
                  <PreviewMount node={previewNode()} class="h-full" />
                </div>
              )}
            </div>
          </Show>
        </div>
      </Modal>

      {/* 云端删除确认弹窗 */}
      <Modal
        open={showDeleteModal()}
        onClose={() => setShowDeleteModal(false)}
        title={t("posts.deleteConfirmTitle")}
        description={t("posts.deleteConfirmMsg", { count: String(pathsToDelete().length) })}
        size="md"
        footer={
          <div class="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setShowDeleteModal(false)}>
              取消
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deleting()}
              icon="i-ri-delete-bin-line"
              onClick={() => void confirmDelete()}
            >
              确认从云端删除 ({pathsToDelete().length})
            </Button>
          </div>
        }
      >
        <div class="max-h-60 overflow-y-auto flex flex-col border border-[var(--border)] rounded-[4px] bg-[var(--g-1)] divide-y divide-[var(--border)]">
          <For each={pathsToDelete()}>
            {(p) => {
              const post = posts()?.find((item) => item.path === p);
              return (
                <div class="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                  <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span class="font-medium text-[var(--text)] leading-normal truncate">
                      {post?.title || p}
                    </span>
                    <span class="font-mono text-[11px] text-[var(--muted)] leading-normal truncate">
                      {p}
                    </span>
                  </div>
                  <Show when={post}>
                    <Badge variant={post?.draft ? "warning" : "success"} size="sm">
                      {post?.draft ? "草稿" : "已发布"}
                    </Badge>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Modal>
    </div>
  );
}
