import { createResource, For, Show } from "solid-js";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";

export function Sync(): import("solid-js").JSX.Element {
  const [log, { refetch }] = createResource(async () => {
    const client = apiStore.getClient();
    const res = await client.syncLog();
    return res.entries;
  });

  return (
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">{t("sync.title")}</h1>
        <button
          type="button"
          onClick={() => void refetch()}
          class="px-3 py-1.5 rounded border border-[var(--border)] text-sm"
        >
          <span class="i-ri-refresh-line mr-1" />
          刷新
        </button>
      </div>

      <Show when={log.error}>
        <Alert variant="error">{messageOf(log.error)}</Alert>
      </Show>

      <Show when={log.loading}>
        <p class="text-sm text-muted">{t("common.loading")}</p>
      </Show>

      <Show when={log()}>
        {(entries) => (
          <Show
            when={entries().length > 0}
            fallback={<p class="text-sm text-muted">{t("sync.empty")}</p>}
          >
            <div class="surface overflow-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-[var(--border)] text-left text-xs text-muted">
                    <th class="px-3 py-2">时间</th>
                    <th class="px-3 py-2">文章数</th>
                    <th class="px-3 py-2">变更</th>
                    <th class="px-3 py-2">删除</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={entries()}>
                    {(entry) => (
                      <tr class="border-b border-[var(--border)] last:border-0">
                        <td class="px-3 py-2 text-xs">{new Date(entry.at).toLocaleString()}</td>
                        <td class="px-3 py-2">{String(entry.postCount)}</td>
                        <td class="px-3 py-2">{String(entry.changed)}</td>
                        <td class="px-3 py-2">{String(entry.deleted)}</td>
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
