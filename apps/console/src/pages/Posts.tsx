import { createResource, createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";

export function Posts(): import("solid-js").JSX.Element {
  const [filter, setFilter] = createSignal("");
  const [posts, { refetch }] = createResource(async () => {
    const client = apiStore.getClient();
    const res = await client.postsList();
    return res.posts;
  });

  // 远程编辑（Primary 模式）：读 D1 正文 → 编辑 → POST /api/posts → 自动触发 git 导出
  const [editingPath, setEditingPath] = createSignal<string | null>(null);
  const [editContent, setEditContent] = createSignal("");
  const [editLoading, setEditLoading] = createSignal(false);
  const [editSaving, setEditSaving] = createSignal(false);
  const [editError, setEditError] = createSignal<string | null>(null);
  const [editResult, setEditResult] = createSignal<string | null>(null);

  const openEdit = async (path: string): Promise<void> => {
    setEditingPath(path);
    setEditError(null);
    setEditResult(null);
    setEditLoading(true);
    try {
      const res = await apiStore.getClient().getPostContent(path);
      setEditContent(res.content);
    } catch (err: unknown) {
      setEditError(messageOf(err));
    } finally {
      setEditLoading(false);
    }
  };

  const saveEdit = async (): Promise<void> => {
    const path = editingPath();
    if (path === null) return;
    setEditSaving(true);
    setEditError(null);
    setEditResult(null);
    try {
      const res = await apiStore.getClient().upsertPost({ path, content: editContent() });
      setEditResult(
        `${res.changed ? "已更新" : "无正文变化"}${res.dispatched ? "，已触发 Git 导出" : "（GitHub 未配置，未导出）"}`,
      );
      await refetch();
    } catch (err: unknown) {
      setEditError(messageOf(err));
    } finally {
      setEditSaving(false);
    }
  };

  const filtered = (): ReturnType<typeof posts> => {
    const f = filter().toLowerCase();
    const list = posts();
    if (list === undefined) return undefined;
    if (f.length === 0) return list;
    return list.filter(
      (p: { title: string; slug: string }) =>
        p.title.toLowerCase().includes(f) || p.slug.toLowerCase().includes(f),
    );
  };

  return (
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-2">
        <h1 class="text-xl font-bold">{t("posts.title")}</h1>
        <button
          type="button"
          onClick={() => void refetch()}
          class="px-3 py-1.5 rounded border border-[var(--border)] text-sm hover:bg-[var(--surface)]"
        >
          <span class="i-ri-refresh-line mr-1" />
          {t("posts.refresh")}
        </button>
      </div>

      <input
        value={filter()}
        onInput={(e) => setFilter(e.currentTarget.value)}
        placeholder={t("posts.filter")}
        class="px-3 py-2 rounded border border-[var(--border)] bg-[var(--surface)] text-sm w-full max-w-sm"
      />

      <Show when={posts.error}>
        <Alert variant="error">{messageOf(posts.error)}</Alert>
      </Show>

      <Show when={posts.loading}>
        <p class="text-sm text-muted">{t("common.loading")}</p>
      </Show>

      <Show when={filtered()}>
        {(list) => (
          <Show
            when={list().length > 0}
            fallback={<p class="text-sm text-muted">{t("posts.empty")}</p>}
          >
            <div class="surface overflow-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-[var(--border)] text-left text-xs text-muted">
                    <th class="px-3 py-2">标题</th>
                    <th class="px-3 py-2">slug</th>
                    <th class="px-3 py-2">状态</th>
                    <th class="px-3 py-2">分类</th>
                    <th class="px-3 py-2">AI</th>
                    <th class="px-3 py-2">更新</th>
                    <th class="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  <For each={list()}>
                    {(post: {
                      path: string;
                      title: string;
                      slug: string;
                      draft: boolean;
                      categories: string[];
                      hash: string;
                      updatedAt: string;
                      ai: {
                        summary: { present: boolean; model: string | null };
                        embed: { present: boolean; model: string | null };
                      };
                    }) => (
                      <tr class="border-b border-[var(--border)] last:border-0">
                        <td class="px-3 py-2" title={post.hash}>
                          {post.title}
                        </td>
                        <td class="px-3 py-2 text-muted">{post.slug}</td>
                        <td class="px-3 py-2">
                          {post.draft ? (
                            <span class="chip chip-warning">草稿</span>
                          ) : (
                            <span class="chip chip-success">已发布</span>
                          )}
                        </td>
                        <td class="px-3 py-2 text-muted">{post.categories.join(", ") || "—"}</td>
                        <td class="px-3 py-2">
                          <span
                            class={`inline-flex items-center gap-1 text-xs ${post.ai.summary.present ? "text-[var(--ok)]" : "text-muted"}`}
                            title={post.ai.summary.model ?? ""}
                          >
                            <span
                              class={
                                post.ai.summary.present ? "i-ri-check-line" : "i-ri-close-line"
                              }
                            />
                            {t("posts.ai.summary")}
                          </span>
                          <span class="mx-1 text-muted">/</span>
                          <span
                            class={`inline-flex items-center gap-1 text-xs ${post.ai.embed.present ? "text-[var(--ok)]" : "text-muted"}`}
                            title={post.ai.embed.model ?? ""}
                          >
                            <span
                              class={post.ai.embed.present ? "i-ri-check-line" : "i-ri-close-line"}
                            />
                            {t("posts.ai.embed")}
                          </span>
                        </td>
                        <td class="px-3 py-2 text-xs text-muted">{post.updatedAt.slice(0, 10)}</td>
                        <td class="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => void openEdit(post.path)}
                            class="px-2 py-1 rounded border border-[var(--border)] text-xs hover:bg-[var(--surface)]"
                          >
                            {t("posts.editRemote")}
                          </button>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        )}
      </Show>

      <Show when={editingPath() !== null}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div class="surface w-full max-w-3xl flex flex-col gap-3 p-4 max-h-[85vh]">
            <div class="flex items-center justify-between">
              <h2 class="font-semibold text-sm break-all">远程编辑：{editingPath()}</h2>
              <button
                type="button"
                onClick={() => setEditingPath(null)}
                class="text-muted hover:text-[var(--text-color)]"
              >
                <span class="i-ri-close-line" />
              </button>
            </div>
            <Show when={editError() !== null}>
              <Alert variant="error">{editError()}</Alert>
            </Show>
            <Show when={editResult() !== null}>
              <Alert variant="success">{editResult()}</Alert>
            </Show>
            <Show when={editLoading()}>
              <p class="text-sm text-muted">{t("common.loading")}</p>
            </Show>
            <textarea
              value={editContent()}
              onInput={(e) => setEditContent(e.currentTarget.value)}
              spellcheck={false}
              class="flex-1 min-h-[50vh] p-3 rounded border border-[var(--border)] bg-[var(--bg)] text-sm font-mono resize-y"
            />
            <div class="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setEditingPath(null)}
                class="px-3 py-1.5 rounded border border-[var(--border)] text-sm"
              >
                取消
              </button>
              <button
                type="button"
                disabled={editSaving()}
                onClick={() => void saveEdit()}
                class="px-3 py-1.5 rounded bg-[var(--accent)] text-white text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {editSaving() ? t("posts.editing") : t("posts.editSave")}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
