import { createResource, createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { projectStore } from "../store/project";
import { isTauri } from "../tauri/bridge";
import { buildCloudSyncPayload } from "../lib/syncCloud";
import type { SyncUploadResponse } from "@hyacine/contract";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";

export function Sync(): import("solid-js").JSX.Element {
  const [log, { refetch }] = createResource(async () => {
    const client = apiStore.getClient();
    const res = await client.syncLog();
    return res.entries;
  });

  const [syncing, setSyncing] = createSignal(false);
  const [syncError, setSyncError] = createSignal<string | null>(null);
  const [lastResult, setLastResult] = createSignal<SyncUploadResponse | null>(null);
  const [exporting, setExporting] = createSignal(false);
  const [exportMsg, setExportMsg] = createSignal<{ kind: "ok" | "err"; text: string } | null>(null);

  const handleExport = async (): Promise<void> => {
    setExporting(true);
    setExportMsg(null);
    try {
      const res = await apiStore.getClient().triggerExport();
      if (res.dispatched) {
        setExportMsg({ kind: "ok", text: `已触发 Git 导出 → ${res.repo ?? ""}` });
      } else {
        setExportMsg({ kind: "err", text: res.error ?? "导出失败" });
      }
    } catch (err: unknown) {
      setExportMsg({ kind: "err", text: messageOf(err) });
    } finally {
      setExporting(false);
    }
  };

  const handleSyncCloud = async (): Promise<void> => {
    setSyncing(true);
    setSyncError(null);
    setLastResult(null);
    try {
      if (!isTauri()) throw new Error("仅桌面模式可用");
      const dir = projectStore.getProjectDir();
      const cfg = projectStore.projectConfig();
      const posts = projectStore.posts();
      if (dir === null || cfg === null) {
        throw new Error("未选择博客目录，请先在「工作区」打开项目");
      }
      const payload = await buildCloudSyncPayload({
        projectRoot: dir,
        contentDir: cfg.contentDir,
        assetsDir: cfg.assetsDir,
        posts,
      });
      const client = apiStore.getClient();
      const res = await client.syncUpload(payload);
      setLastResult(res);
      await refetch();
    } catch (err: unknown) {
      setSyncError(messageOf(err));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">{t("sync.title")}</h1>
        <div class="flex items-center gap-2">
          <button
            type="button"
            disabled={syncing()}
            onClick={() => void handleSyncCloud()}
            class="px-3 py-1.5 rounded bg-[var(--accent)] text-white text-sm cursor-pointer hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            <span class="i-ri-upload-line mr-1" />
            {syncing() ? t("sync.uploading") : t("sync.uploadNow")}
          </button>
          <button
            type="button"
            disabled={exporting()}
            onClick={() => void handleExport()}
            title="Primary 模式：触发 GitHub Action 把 D1 导出到博客仓库"
            class="px-3 py-1.5 rounded border border-[var(--border)] text-sm disabled:opacity-50"
          >
            <span class="i-ri-git-branch-line mr-1" />
            {exporting() ? t("sync.exporting") : t("sync.exportNow")}
          </button>
          <button
            type="button"
            onClick={() => void refetch()}
            class="px-3 py-1.5 rounded border border-[var(--border)] text-sm"
          >
            <span class="i-ri-refresh-line mr-1" />
            {t("sync.refresh")}
          </button>
        </div>
      </div>

      <Alert variant="info">{t("sync.hint")}</Alert>

      <Show when={syncError()}>
        <Alert variant="error">{syncError()}</Alert>
      </Show>

      <Show when={exportMsg()}>
        {(m) => <Alert variant={m().kind === "ok" ? "success" : "error"}>{m().text}</Alert>}
      </Show>

      <Show when={lastResult()}>
        {(r) => (
          <Alert variant="success">
            {t("sync.uploaded", {
              posts: String(r().accepted.posts),
              assets: String(r().accepted.assets),
              changed: String(r().changedHashes.length),
              deleted: String(r().deletedPaths.length),
            })}
            <Show when={r().ai.needs.length > 0}>
              <span class="block mt-1 text-sm">
                {t("sync.needs", { count: String(r().ai.needs.length) })}
              </span>
            </Show>
          </Alert>
        )}
      </Show>

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
