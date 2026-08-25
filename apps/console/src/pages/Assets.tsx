import { createResource, createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Badge } from "../components/Badge";
import { Card } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
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

type ViewMode = "grid" | "table";

function formatBytes(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function Assets(): import("solid-js").JSX.Element {
  const [uploading, setUploading] = createSignal(false);
  const [uploadError, setUploadError] = createSignal<string | null>(null);
  const [viewMode, setViewMode] = createSignal<ViewMode>("grid");
  const [search, setSearch] = createSignal("");

  const [assets, { refetch }] = createResource(async () => {
    const client = apiStore.getClient();
    const res = await client.assetsList();
    return res.assets;
  });

  const handleUpload = async (file: File): Promise<void> => {
    setUploading(true);
    setUploadError(null);
    try {
      const client = apiStore.getClient();
      const presign = await client.presign({
        key: `images/${file.name}`,
        contentType: file.type || "application/octet-stream",
        size: file.size,
      });
      const putResponse = await fetch(presign.url, {
        method: presign.method,
        headers: presign.headers,
        body: file,
      });
      if (!putResponse.ok) {
        const hint =
          putResponse.status === 0 || putResponse.status >= 400 ? ` ${t("assets.corsHint")}` : "";
        throw new Error(`上传失败 ${String(putResponse.status)}${hint}`);
      }
      await client.registerAsset({
        path: `images/${file.name}`,
        assetType: "image",
        fileType: file.type || "application/octet-stream",
        r2Key: presign.key,
        size: file.size,
      });
      toast.success(file.name, "资产上传成功");
      await refetch();
    } catch (err: unknown) {
      setUploadError(messageOf(err));
      toast.error(messageOf(err), "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const copyMarkdown = async (path: string): Promise<void> => {
    const md = `![${path}](/${path})`;
    await navigator.clipboard.writeText(md);
    toast.success(md, "已复制 Markdown 图片标签");
  };

  const copyPath = async (path: string): Promise<void> => {
    await navigator.clipboard.writeText(`/${path}`);
    toast.success(`/${path}`, "已复制路径");
  };

  const filteredAssets = (): ReturnType<typeof assets> => {
    const list = assets();
    if (!list) return undefined;
    const q = search().toLowerCase().trim();
    if (q.length === 0) return list;
    return list.filter((a) => a.path.toLowerCase().includes(q) || a.r2Key?.toLowerCase().includes(q));
  };

  return (
    <div class="flex flex-col gap-6">
      <PageHeader
        title={t("assets.title")}
        description="管理存储在 Cloudflare R2 对象存储中的静态图片与多媒体资产"
        badge={
          <Show when={assets()}>
            <Badge variant="neutral">共 {assets()?.length ?? 0} 个资产</Badge>
          </Show>
        }
        actions={
          <div class="flex items-center gap-2">
            <label class="inline-flex items-center justify-center cursor-pointer select-none transition-all duration-150 shrink-0 font-sans px-3.5 py-2 text-xs font-medium gap-1.5 rounded-[4px] bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-xs">
              <Show when={uploading()}>
                <Spinner size="xs" />
              </Show>
              <Show when={!uploading()}>
                <span class="i-ri-upload-2-line text-sm" />
              </Show>
              <span>{uploading() ? t("assets.uploading") : t("assets.upload")}</span>
              <input
                type="file"
                class="hidden"
                accept="image/*"
                disabled={uploading()}
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file !== undefined) void handleUpload(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <Button
              variant="outline"
              size="sm"
              loading={assets.loading}
              icon="i-ri-refresh-line"
              onClick={() => void refetch()}
            >
              {t("common.refresh")}
            </Button>
          </div>
        }
      />

      <Show when={uploadError() !== null}>
        <Alert variant="error" title="上传错误">
          {uploadError()}
        </Alert>
      </Show>

      {/* Filter and View Switcher Bar */}
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--surface)] p-3 border border-[var(--border)] rounded-[6px]">
        <Input
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          placeholder="搜索资产路径 / 文件名..."
          icon="i-ri-search-line"
          containerClass="max-w-xs flex-1"
        />

        <SegmentedControl<ViewMode>
          value={viewMode()}
          onChange={setViewMode}
          size="sm"
          items={[
            { value: "grid", label: "网格图库", icon: "i-ri-layout-grid-line" },
            { value: "table", label: "列表", icon: "i-ri-list-check" },
          ]}
        />
      </div>

      <Show when={assets.error}>
        <Alert variant="error" title="加载资产列表失败">
          {messageOf(assets.error)}
        </Alert>
      </Show>

      <Show when={assets.loading}>
        <div class="p-12 flex flex-col items-center justify-center gap-3 text-[var(--muted)]">
          <Spinner size="md" />
          <span class="text-xs">{t("common.loading")}</span>
        </div>
      </Show>

      <Show when={filteredAssets()}>
        {(list) => (
          <Show
            when={list().length > 0}
            fallback={
              <EmptyState
                icon="i-ri-image-line"
                title={assets()?.length === 0 ? t("assets.empty") : "无匹配资产"}
                description={
                  assets()?.length === 0
                    ? "点击右上角「上传」把图片上传到 Cloudflare R2 存储"
                    : "请尝试更换搜索关键字"
                }
              />
            }
          >
            {/* View Mode: Grid (Gallery) */}
            <Show when={viewMode() === "grid"}>
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <For each={list()}>
                  {(asset) => {
                    const isImg = asset.assetType === "image" || asset.fileType?.startsWith("image/");
                    return (
                      <Card hoverable class="flex flex-col justify-between p-0 overflow-hidden group">
                        {/* Image Preview / Thumbnail Box */}
                        <div class="h-40 bg-[var(--g-2)] relative flex items-center justify-center overflow-hidden border-b border-[var(--border)]">
                          <Show
                            when={isImg}
                            fallback={
                              <div class="flex flex-col items-center gap-1 text-[var(--muted)]">
                                <span class="i-ri-file-3-line text-4xl" />
                                <span class="text-[11px] uppercase font-mono">{asset.fileType}</span>
                              </div>
                            }
                          >
                            <div class="flex items-center justify-center w-full h-full p-2 text-[var(--muted)]">
                              <span class="i-ri-image-2-line text-4xl text-[var(--muted)] opacity-40 group-hover:scale-110 transition-transform duration-300" />
                            </div>
                          </Show>
                          <div class="absolute top-2 right-2">
                            <Badge variant="neutral" size="sm">
                              {formatBytes(asset.size)}
                            </Badge>
                          </div>
                        </div>

                        {/* Card Info */}
                        <div class="p-3.5 flex flex-col gap-2 flex-1 justify-between">
                          <div class="flex flex-col gap-0.5">
                            <span class="font-medium text-xs text-[var(--text)] truncate font-mono" title={asset.path}>
                              {asset.path}
                            </span>
                            <span class="text-[10px] text-[var(--muted)]">
                              更新于 {asset.updatedAt.slice(0, 10)}
                            </span>
                          </div>

                          <div class="flex items-center gap-1.5 pt-2 border-t border-[var(--border)]">
                            <Button
                              variant="secondary"
                              size="xs"
                              class="flex-1"
                              icon="i-ri-code-s-slash-line"
                              onClick={() => void copyMarkdown(asset.path)}
                            >
                              复制 MD
                            </Button>
                            <Button
                              variant="outline"
                              size="xs"
                              icon="i-ri-file-copy-line"
                              onClick={() => void copyPath(asset.path)}
                              title="复制路径"
                            />
                          </div>
                        </div>
                      </Card>
                    );
                  }}
                </For>
              </div>
            </Show>

            {/* View Mode: Table */}
            <Show when={viewMode() === "table"}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow hoverable={false}>
                      <TableHeader class="w-[35%]">资产路径</TableHeader>
                      <TableHeader class="w-[15%]">类型</TableHeader>
                      <TableHeader class="w-[12%]">大小</TableHeader>
                      <TableHeader class="w-[18%]">R2 Key</TableHeader>
                      <TableHeader class="w-[10%]">更新日期</TableHeader>
                      <TableHeader class="w-[10%] text-right">操作</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <For each={list()}>
                      {(asset) => (
                        <TableRow>
                          <TableCell>
                            <div class="flex items-center gap-2">
                              <span class="i-ri-image-line text-[var(--muted)] text-base" />
                              <span class="font-mono text-xs font-medium text-[var(--text)]">{asset.path}</span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <span class="text-xs text-[var(--muted)]">
                              {asset.assetType}/{asset.fileType}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span class="text-xs font-mono text-[var(--text)]">
                              {formatBytes(asset.size)}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span class="font-mono text-xs text-[var(--muted)] truncate max-w-36 block">
                              {asset.r2Key ?? "—"}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span class="text-xs text-[var(--muted)]">{asset.updatedAt.slice(0, 10)}</span>
                          </TableCell>

                          <TableCell class="text-right">
                            <Button
                              variant="secondary"
                              size="xs"
                              icon="i-ri-code-s-slash-line"
                              onClick={() => void copyMarkdown(asset.path)}
                            >
                              复制 MD
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
        )}
      </Show>
    </div>
  );
}
