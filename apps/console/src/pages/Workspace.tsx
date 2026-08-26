import { createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { t } from "../i18n";
import { autoSlug, getCollections } from "@hyacine/contract";
import { isTauri, openFolderDialog, writeTextFile, removeFile } from "../tauri/bridge";
import { projectStore } from "../store/project";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Modal } from "../components/Modal";
import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
import { Spinner } from "../components/Spinner";
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

export function Workspace(): import("solid-js").JSX.Element {
  const navigate = useNavigate();
  const [filter, setFilter] = createSignal("");
  const [activeCollection, setActiveCollection] = createSignal<string>("all");

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
  const toggleSelectAll = (): void => {
    const visible = filteredPosts().map((p) => p.path);
    if (visible.every((p) => selectedPaths().includes(p))) {
      setSelectedPaths(selectedPaths().filter((p) => !visible.includes(p)));
    } else {
      const next = new Set([...selectedPaths(), ...visible]);
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
    const dir = projectStore.projectDir();
    if (dir === null) return;
    const targets = pathsToDelete();
    if (targets.length === 0) return;
    setDeleting(true);
    let successCount = 0;
    const errors: string[] = [];

    for (const p of targets) {
      try {
        const full = `${dir}/${p}`;
        await removeFile(full);
        successCount++;
      } catch (e: unknown) {
        errors.push(`${p}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    setDeleting(false);
    setShowDeleteModal(false);
    setSelectedPaths(selectedPaths().filter((p) => !targets.includes(p)));
    await projectStore.refreshPosts();

    if (errors.length > 0) {
      toast.error(`删除遇到错误：${errors.join("; ")}`, "部分删除失败");
    } else {
      toast.success(`已成功删除 ${successCount} 个文章文件`, "文章已删除");
    }
  };

  const handleOpen = async (): Promise<void> => {
    try {
      const dir = await openFolderDialog();
      if (dir === null) return;
      await projectStore.openProject(dir);
      toast.success(dir, "已成功打开博客目录");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e), "打开项目失败");
    }
  };

  const handleEdit = (path: string): void => {
    navigate(`/editor?path=${encodeURIComponent(path)}`);
  };

  const handleNew = async (): Promise<void> => {
    const dir = projectStore.projectDir();
    if (dir === null) return;
    try {
      const title = `新文章-${new Date().toISOString().slice(0, 10)}`;
      const slug = autoSlug(title);
      const content = `---\ntitle: ${title}\nslug: ${slug}\ndate: ${new Date().toISOString().slice(0, 10)}\ncategories: []\ndraft: true\n---\n\n正文...\n`;
      const cfg = projectStore.projectConfig();
      const [first] = cfg !== null ? getCollections(cfg) : [];
      const collectionDir = first?.dir ?? "src/posts";
      const ext = cfg?.postExtension?.[0] ?? ".md";
      const relPath = `${collectionDir}/${slug}${ext}`;
      const full = `${dir}/${relPath}`;
      await writeTextFile(full, content);
      await projectStore.refreshPosts();
      toast.success(title, "已新建文章");
      handleEdit(relPath);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e), "新建文章失败");
    }
  };

  // 集合列表
  const collections = (): string[] => {
    const posts = projectStore.posts();
    const cols = new Set<string>();
    for (const p of posts) {
      if (p.collection) cols.add(p.collection);
    }
    return Array.from(cols);
  };

  // 过滤后的文章列表
  const filteredPosts = (): typeof projectStore.posts extends () => infer R ? R : never => {
    const f = filter().toLowerCase().trim();
    const col = activeCollection();
    const list = projectStore.posts();

    return list.filter((p) => {
      const matchText =
        f.length === 0 ||
        p.title.toLowerCase().includes(f) ||
        p.slug.toLowerCase().includes(f) ||
        p.path.toLowerCase().includes(f);
      if (!matchText) return false;

      if (col !== "all" && p.collection !== col) return false;
      return true;
    });
  };

  return (
    <div class="flex flex-col gap-6">
      <PageHeader
        title={t("workspace.title")}
        description="管理本地 Astro 博客项目目录、集合配置与本地文章文件"
        actions={
          <Show when={isTauri()}>
            <div class="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon="i-ri-folder-open-line"
                onClick={() => void handleOpen()}
              >
                {t("workspace.open")}
              </Button>
              <Show when={projectStore.projectDir() !== null}>
                <Button
                  variant="outline"
                  size="sm"
                  loading={projectStore.loading()}
                  icon="i-ri-refresh-line"
                  onClick={() => void projectStore.refreshPosts()}
                >
                  {t("common.refresh")}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon="i-ri-add-line"
                  onClick={() => void handleNew()}
                >
                  {t("workspace.new")}
                </Button>
              </Show>
            </div>
          </Show>
        }
      />

      <Show when={!isTauri()}>
        <Alert variant="info" title="环境提示">
          {t("workspace.requireTauri")}
        </Alert>
      </Show>

      {/* When no project opened */}
      <Show when={isTauri() && projectStore.projectDir() === null}>
        <EmptyState
          icon="i-ri-folder-upload-line"
          title={t("workspace.empty")}
          description="选择包含 hyacine.yml 的 Astro Blog 项目目录，即可在本地离线查看、编写文章与执行 Git 同步。"
          action={
            <Button
              variant="primary"
              size="md"
              icon="i-ri-folder-open-line"
              onClick={() => void handleOpen()}
            >
              {t("workspace.open")}
            </Button>
          }
        />
      </Show>

      {/* Project Opened */}
      <Show when={projectStore.projectDir() !== null}>
        <div class="flex flex-col gap-5">
          {/* Project Summary Banner */}
          <Card class="bg-gradient-to-r from-[var(--surface)] to-[var(--g-1)]">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="flex items-start sm:items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center text-xl shrink-0 shadow-xs">
                  <span class="i-ri-folder-3-fill" />
                </div>
                <div class="flex flex-col gap-0.5">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-semibold text-sm text-[var(--text)]">
                      {projectStore.projectDir()?.replace(/\\/g, "/").split("/").pop() || "Astro ShokaX Blog"}
                    </span>
                    <Badge variant="primary" size="sm">
                      {projectStore.posts().length} 篇文章
                    </Badge>
                  </div>
                  <span class="font-mono text-xs text-[var(--muted)] truncate max-w-lg">
                    {projectStore.projectDir()}
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-2 self-end sm:self-center">
                <Button
                  variant="secondary"
                  size="xs"
                  icon="i-ri-folder-transfer-line"
                  onClick={() => void handleOpen()}
                >
                  切换目录
                </Button>
              </div>
            </div>
          </Card>

          <Show when={projectStore.error() !== null}>
            <Alert variant="error" title="读取项目错误">
              {projectStore.error()}
            </Alert>
          </Show>

          {/* Search & Filter Bar */}
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--surface)] p-3 border border-[var(--border)] rounded-[6px]">
            <Input
              value={filter()}
              onInput={(e) => setFilter(e.currentTarget.value)}
              placeholder="搜索本地文章标题 / slug / 路径..."
              icon="i-ri-search-line"
              containerClass="max-w-xs flex-1"
            />

            <Show when={collections().length > 1}>
              <div class="flex items-center gap-1 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveCollection("all")}
                  class={`px-2.5 py-1 text-xs rounded-[4px] font-medium transition-colors ${
                    activeCollection() === "all"
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--muted)] hover:bg-[var(--g-2)]"
                  }`}
                >
                  全部集合
                </button>
                <For each={collections()}>
                  {(col) => (
                    <button
                      type="button"
                      onClick={() => setActiveCollection(col)}
                      class={`px-2.5 py-1 text-xs rounded-[4px] font-medium transition-colors ${
                        activeCollection() === col
                          ? "bg-[var(--accent)] text-white"
                          : "text-[var(--muted)] hover:bg-[var(--g-2)]"
                      }`}
                    >
                      {col}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>

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
                  {t("workspace.batchDelete")}
                </Button>
              </div>
            </div>
          </Show>

          <Show when={projectStore.loading()}>
            <div class="p-8 flex items-center justify-center gap-2 text-[var(--muted)]">
              <Spinner size="sm" />
              <span>{t("common.loading")}</span>
            </div>
          </Show>

          {/* Posts Table */}
          <Show when={!projectStore.loading()}>
            <Show
              when={filteredPosts().length > 0}
              fallback={
                <EmptyState
                  icon="i-ri-article-line"
                  title={projectStore.posts().length === 0 ? t("workspace.noPosts") : "无匹配文章"}
                  description={
                    projectStore.posts().length === 0
                      ? "点击右上角「新建文章」在当前集合目录下创建第一篇文章"
                      : "尝试更换搜索关键字"
                  }
                  action={
                    projectStore.posts().length === 0 ? (
                      <Button
                        variant="primary"
                        size="sm"
                        icon="i-ri-add-line"
                        onClick={() => void handleNew()}
                      >
                        {t("workspace.new")}
                      </Button>
                    ) : undefined
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
                            filteredPosts().length > 0 &&
                            filteredPosts().every((p) => selectedPaths().includes(p.path))
                          }
                          onChange={toggleSelectAll}
                          class="rounded text-[var(--accent)] cursor-pointer"
                          aria-label="全选"
                        />
                      </TableHeader>
                      <TableHeader class="w-[33%]">文章标题与文件</TableHeader>
                      <TableHeader class="w-[12%]">集合</TableHeader>
                      <TableHeader class="w-[17%]">Slug</TableHeader>
                      <TableHeader class="w-[12%]">状态</TableHeader>
                      <TableHeader class="w-[10%]">AI 摘要</TableHeader>
                      <TableHeader class="w-[12%] text-right">操作</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <For each={filteredPosts()}>
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
                              <span class="font-medium text-[var(--text)]">{post.title}</span>
                              <span class="text-[11px] font-mono text-[var(--muted)] truncate max-w-xs">
                                {post.path}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant="neutral" size="sm">
                              {post.collection}
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
                            {post.summaryPresent ? (
                              <span class="inline-flex items-center gap-1 text-xs text-[var(--ok)] font-medium">
                                <span class="i-ri-checkbox-circle-fill" />
                                存在
                              </span>
                            ) : (
                              <span class="text-xs text-[var(--muted)]">—</span>
                            )}
                          </TableCell>

                          <TableCell class="text-right">
                            <div class="flex items-center justify-end gap-1.5">
                              <Button
                                variant="secondary"
                                size="xs"
                                icon="i-ri-edit-box-line"
                                onClick={() => handleEdit(post.path)}
                              >
                                {t("workspace.edit")}
                              </Button>
                              <Button
                                variant="ghost"
                                size="xs"
                                class="text-[var(--danger)] hover:bg-[var(--danger)]/10"
                                icon="i-ri-delete-bin-line"
                                onClick={() => promptDeleteSingle(post.path)}
                                title={t("workspace.delete")}
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
          </Show>

          {/* 删除确认弹窗 */}
          <Modal
            open={showDeleteModal()}
            onClose={() => setShowDeleteModal(false)}
            title={t("workspace.deleteConfirmTitle")}
            description={t("workspace.deleteConfirmMsg", { count: String(pathsToDelete().length) })}
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
                  确认删除 ({pathsToDelete().length})
                </Button>
              </div>
            }
          >
            <div class="max-h-60 overflow-y-auto flex flex-col border border-[var(--border)] rounded-[4px] bg-[var(--g-1)] divide-y divide-[var(--border)]">
              <For each={pathsToDelete()}>
                {(p) => {
                  const post = projectStore.posts().find((item) => item.path === p);
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
      </Show>
    </div>
  );
}
