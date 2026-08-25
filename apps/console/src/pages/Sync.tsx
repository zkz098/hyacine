import { createResource, createSignal, For, Show, onMount } from "solid-js";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { projectStore } from "../store/project";
import { isTauri, writeTextFile } from "../tauri/bridge";
import { buildCloudSyncPayload } from "../lib/syncCloud";
import { pullExportToLocal } from "../lib/exportPull";
import { getCollections, type SyncUploadResponse } from "@hyacine/contract";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/Card";
import { Badge } from "../components/Badge";
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
  const [syncNote, setSyncNote] = createSignal<string | null>(null);

  // Primary 可用性
  const [primaryAvailable, setPrimaryAvailable] = createSignal(false);
  onMount(() => {
    void apiStore
      .getClient()
      .health()
      .then((h) => setPrimaryAvailable(h.primary.available))
      .catch(() => setPrimaryAvailable(false));
  });

  const handleExport = async (): Promise<void> => {
    setExporting(true);
    setExportMsg(null);
    try {
      const res = await apiStore.getClient().triggerExport();
      if (res.dispatched) {
        const msg = `已触发 Git 导出任务 → ${res.repo ?? ""}`;
        setExportMsg({ kind: "ok", text: msg });
        toast.success(msg);
      } else {
        const msg = res.error ?? "导出失败";
        setExportMsg({ kind: "err", text: msg });
        toast.error(msg);
      }
    } catch (err: unknown) {
      const msg = messageOf(err);
      setExportMsg({ kind: "err", text: msg });
      toast.error(msg);
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
        throw new Error("未选择博客目录，请先在「工作台」打开项目");
      }

      const LS_KEY = `hyacine:lastSyncPaths:${dir}`;
      let lastPaths: string[] | null = null;
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw !== null) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) lastPaths = parsed as string[];
        }
      } catch {
        lastPaths = null;
      }

      const payload = await buildCloudSyncPayload({
        projectRoot: dir,
        collections: getCollections(cfg),
        assetsDir: cfg.assetsDir,
        posts,
        lastPaths,
      });

      const client = apiStore.getClient();
      const res = await client.syncUpload(payload);
      setLastResult(res);
      setSyncNote(null);
      toast.success(
        `文章: ${res.accepted.posts}, 资产: ${res.accepted.assets}, 变更: ${res.changedHashes.length}, 删除: ${res.deletedPaths.length}`,
        "同步上行成功",
      );

      try {
        localStorage.setItem(LS_KEY, JSON.stringify(payload.posts.map((p) => p.path)));
      } catch {
        // ignore
      }

      if (primaryAvailable()) {
        const snapshot = await client.exportSnapshot();
        const { written } = await pullExportToLocal(dir, snapshot, {
          writeTextFile,
        });
        const note = `${t("sync.pullDone")}（${String(written)} 篇）`;
        setSyncNote(note);
        toast.info(note);
        await projectStore.refreshPosts();
      }
      await refetch();
    } catch (err: unknown) {
      setSyncError(messageOf(err));
      toast.error(messageOf(err), "同步云端失败");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div class="flex flex-col gap-6">
      <PageHeader
        title={t("sync.title")}
        description="管理本地项目与云端 D1/R2 数据平面之间的双向同步及 Git 导出"
        actions={
          <div class="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              loading={syncing()}
              icon="i-ri-upload-cloud-line"
              onClick={() => void handleSyncCloud()}
            >
              {syncing() ? t("sync.uploading") : t("sync.uploadNow")}
            </Button>

            <Button
              variant="outline"
              size="sm"
              loading={exporting()}
              disabled={!primaryAvailable()}
              icon="i-ri-git-branch-line"
              onClick={() => void handleExport()}
              title={
                primaryAvailable()
                  ? "Primary 模式：触发 GitHub Action 把 D1 导出到博客仓库"
                  : t("sync.exportDisabled")
              }
            >
              {exporting() ? t("sync.exporting") : t("sync.exportNow")}
            </Button>

            <Button
              variant="outline"
              size="sm"
              loading={log.loading}
              icon="i-ri-refresh-line"
              onClick={() => void refetch()}
            >
              {t("sync.refresh")}
            </Button>
          </div>
        }
      />

      {/* Architecture Explainer Card */}
      <Card class="bg-gradient-to-r from-[var(--surface)] to-[var(--g-1)] border-[var(--border)]">
        <CardHeader class="mb-2">
          <div class="flex items-center gap-2">
            <span class="i-ri-route-line text-[var(--accent)] text-lg" />
            <CardTitle>Hyacine 数据同步机制</CardTitle>
          </div>
        </CardHeader>
        <CardDescription>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 text-xs">
            <div class="p-3 bg-[var(--surface)] rounded-[4px] border border-[var(--border)]">
              <span class="font-semibold text-[var(--text)] block mb-1">1. 本地 → 云端同步</span>
              <span>将本地博客目录中的 Markdown 文件与资产索引计算 Hash 并批量上传到 Cloudflare D1 & R2。</span>
            </div>
            <div class="p-3 bg-[var(--surface)] rounded-[4px] border border-[var(--border)]">
              <span class="font-semibold text-[var(--text)] block mb-1">2. 云端 AI 与索引</span>
              <span>云端自动生成或按需生成 Summary 摘要与 Vector 嵌入，提供给前台搜索与 AI 功能。</span>
            </div>
            <div class="p-3 bg-[var(--surface)] rounded-[4px] border border-[var(--border)]">
              <span class="font-semibold text-[var(--text)] block mb-1">3. Git 导出 (Primary)</span>
              <span>在网页/远程端进行的修改，通过 GitHub Dispatch 触发 Action 回写到 GitHub 仓库完成闭环。</span>
            </div>
          </div>
        </CardDescription>
      </Card>

      <Show when={syncError()}>
        <Alert variant="error" title="同步失败">
          {syncError()}
        </Alert>
      </Show>

      <Show when={syncNote() !== null}>
        <Alert variant="success">{syncNote()}</Alert>
      </Show>

      <Show when={exportMsg()}>
        {(m) => <Alert variant={m().kind === "ok" ? "success" : "error"}>{m().text}</Alert>}
      </Show>

      <Show when={lastResult()}>
        {(r) => (
          <Alert variant="success" title="本次同步结果">
            <div class="flex flex-col gap-1">
              <span>
                {t("sync.uploaded", {
                  posts: String(r().accepted.posts),
                  assets: String(r().accepted.assets),
                  changed: String(r().changedHashes.length),
                  deleted: String(r().deletedPaths.length),
                })}
              </span>
              <Show when={r().ai.needs.length > 0}>
                <span class="text-xs opacity-90">
                  {t("sync.needs", { count: String(r().ai.needs.length) })}
                </span>
              </Show>
            </div>
          </Alert>
        )}
      </Show>

      <Show when={log.error}>
        <Alert variant="error" title="加载同步日志失败">
          {messageOf(log.error)}
        </Alert>
      </Show>

      <Show when={log.loading}>
        <div class="p-12 flex flex-col items-center justify-center gap-3 text-[var(--muted)]">
          <Spinner size="md" />
          <span class="text-xs">{t("common.loading")}</span>
        </div>
      </Show>

      {/* Sync Log Table */}
      <Show when={log()}>
        {(entries) => (
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-[var(--text)]">历史同步记录</h3>
              <Badge variant="neutral">{entries().length} 条记录</Badge>
            </div>

            <Show
              when={entries().length > 0}
              fallback={
                <EmptyState
                  icon="i-ri-history-line"
                  title={t("sync.empty")}
                  description="在顶部点击「同步到云端」执行首次数据上行"
                />
              }
            >
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow hoverable={false}>
                      <TableHeader class="w-[30%]">同步时间</TableHeader>
                      <TableHeader class="w-[20%]">同步文章数</TableHeader>
                      <TableHeader class="w-[25%]">正文变更</TableHeader>
                      <TableHeader class="w-[25%]">删除文章</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <For each={entries()}>
                      {(entry) => (
                        <TableRow>
                          <TableCell>
                            <span class="font-mono text-xs text-[var(--text)]">
                              {new Date(entry.at).toLocaleString()}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span class="font-semibold text-xs text-[var(--text)]">
                              {String(entry.postCount)} 篇
                            </span>
                          </TableCell>

                          <TableCell>
                            <Badge variant={entry.changed > 0 ? "warning" : "neutral"} size="sm">
                              {String(entry.changed)} 篇变更
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <Badge variant={entry.deleted > 0 ? "danger" : "neutral"} size="sm">
                              {String(entry.deleted)} 篇删除
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )}
                    </For>
                  </TableBody>
                </Table>
              </TableContainer>
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}
