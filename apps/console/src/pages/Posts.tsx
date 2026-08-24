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
                  </tr>
                </thead>
                <tbody>
                  <For each={list()}>
                    {(post: {
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
                            <span class="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 text-xs">
                              草稿
                            </span>
                          ) : (
                            <span class="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-xs">
                              已发布
                            </span>
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
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        )}
      </Show>
    </div>
  );
}
