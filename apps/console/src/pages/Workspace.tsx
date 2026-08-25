import { createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { t } from "../i18n";
import { autoSlug, getCollections } from "@hyacine/contract";
import { isTauri, openFolderDialog, writeTextFile } from "../tauri/bridge";
import { projectStore } from "../store/project";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
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
                      <TableHeader class="w-[35%]">文章标题与文件</TableHeader>
                      <TableHeader class="w-[12%]">集合</TableHeader>
                      <TableHeader class="w-[18%]">Slug</TableHeader>
                      <TableHeader class="w-[12%]">状态</TableHeader>
                      <TableHeader class="w-[10%]">AI 摘要</TableHeader>
                      <TableHeader class="w-[13%] text-right">操作</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <For each={filteredPosts()}>
                      {(post) => (
                        <TableRow>
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
                            <Button
                              variant="secondary"
                              size="xs"
                              icon="i-ri-edit-box-line"
                              onClick={() => handleEdit(post.path)}
                            >
                              {t("workspace.edit")}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )}
                    </For>
                  </TableBody>
                </Table>
              </TableContainer>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  );
}
