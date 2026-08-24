import { createResource, For, Show } from "solid-js";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";

export function Dashboard(): import("solid-js").JSX.Element {
  const [stats, { refetch }] = createResource(async () => {
    const client = apiStore.getClient();
    return client.stats();
  });

  return (
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">{t("dashboard.title")}</h1>
        <button
          type="button"
          onClick={() => void refetch()}
          class="px-3 py-1.5 rounded border border-[var(--border)] text-sm hover:bg-[var(--surface)]"
        >
          <span class="i-ri-refresh-line mr-1" />
          {t("dashboard.refresh")}
        </button>
      </div>

      <Show when={stats.error}>
        <Alert variant="error">{messageOf(stats.error)}</Alert>
      </Show>

      <Show when={stats.loading}>
        <p class="text-sm text-muted">{t("common.loading")}</p>
      </Show>

      <Show when={stats()}>
        {(data) => (
          <>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div class="surface p-4">
                <p class="text-xs text-muted">{t("dashboard.posts")}</p>
                <p class="text-2xl font-bold">{data().totals.posts}</p>
              </div>
              <div class="surface p-4">
                <p class="text-xs text-muted">{t("dashboard.drafts")}</p>
                <p class="text-2xl font-bold">{data().totals.drafts}</p>
              </div>
              <div class="surface p-4">
                <p class="text-xs text-muted">{t("dashboard.published")}</p>
                <p class="text-2xl font-bold">{data().totals.published}</p>
              </div>
              <div class="surface p-4">
                <p class="text-xs text-muted">
                  {t("dashboard.assets")} ({t("dashboard.remote")})
                </p>
                <p class="text-2xl font-bold">
                  {data().assets.total} / {data().assets.remote}
                </p>
              </div>
            </div>

            <div class="surface p-4">
              <h2 class="text-sm font-semibold mb-3">{t("dashboard.byCategory")}</h2>
              <div class="flex flex-wrap gap-2">
                <For each={Object.entries(data().byCategory)}>
                  {([cat, count]) => (
                    <span class="px-2 py-1 rounded-full bg-[var(--bg)] border border-[var(--border)] text-xs">
                      {cat} × {String(count)}
                    </span>
                  )}
                </For>
                <Show when={Object.keys(data().byCategory).length === 0}>
                  <span class="text-xs text-muted">—</span>
                </Show>
              </div>
            </div>

            <div class="surface p-4">
              <h2 class="text-sm font-semibold mb-3">{t("dashboard.byMonth")}</h2>
              <div class="flex items-end gap-1 h-24">
                <For each={data().byMonth}>
                  {(entry: { month: string; count: number }) => {
                    const max = Math.max(
                      ...data().byMonth.map((m: { count: number }) => m.count),
                      1,
                    );
                    const h = Math.round((entry.count / max) * 80) + 8;
                    return (
                      <div class="flex flex-col items-center gap-1 flex-1">
                        <div
                          class="w-full rounded-t bg-[var(--accent)]"
                          style={`height:${String(h)}px`}
                          title={`${entry.month}: ${String(entry.count)}`}
                        />
                        <span class="text-[10px] text-muted">{entry.month.slice(5)}</span>
                      </div>
                    );
                  }}
                </For>
                <Show when={data().byMonth.length === 0}>
                  <span class="text-xs text-muted">—</span>
                </Show>
              </div>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}
