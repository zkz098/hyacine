import { createMemo, createResource, createSignal, For, Show } from "solid-js";
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
import { Tabs } from "../components/Tabs";
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
import type { AssetIndexEntry, AssetType } from "@hyacine/contract";

export type AssetCategory = "all" | "image" | "audio" | "video" | "font" | "other";
type ViewMode = "grid" | "table";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif", "svg", "bmp", "ico"]);
const FONT_EXTS = new Set(["ttf", "otf", "woff", "woff2", "eot"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "mkv", "avi", "flv", "wmv"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "flac", "aac", "m4a", "wma", "opus"]);

export function resolveAssetCategory(asset: {
  assetType?: string;
  fileType?: string;
  path?: string;
}): AssetType {
  if (
    asset.assetType === "image" ||
    asset.assetType === "audio" ||
    asset.assetType === "video" ||
    asset.assetType === "font"
  ) {
    return asset.assetType;
  }
  const mime = (asset.fileType ?? "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("font/") || mime.includes("font") || mime.includes("opentype")) return "font";

  const path = asset.path ?? "";
  const ext = path.includes(".") ? (path.split(".").pop() ?? "").toLowerCase() : "";
  if (IMAGE_EXTS.has(ext)) return "image";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (VIDEO_EXTS.has(ext)) return "video";
  if (FONT_EXTS.has(ext)) return "font";
  return "other";
}

const CATEGORY_CONFIG: Record<
  AssetType,
  {
    label: string;
    icon: string;
    badgeVariant: "success" | "warning" | "danger" | "primary" | "neutral";
    dir: string;
  }
> = {
  image: { label: "图片", icon: "i-ri-image-line", badgeVariant: "success", dir: "images" },
  audio: { label: "音频", icon: "i-ri-music-2-line", badgeVariant: "warning", dir: "audio" },
  video: { label: "视频", icon: "i-ri-video-line", badgeVariant: "danger", dir: "video" },
  font: { label: "字体", icon: "i-ri-font-size", badgeVariant: "primary", dir: "fonts" },
  other: { label: "其他", icon: "i-ri-file-3-line", badgeVariant: "neutral", dir: "assets" },
};

function formatBytes(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function Assets(): import("solid-js").JSX.Element {
  const [uploading, setUploading] = createSignal(false);
  const [uploadError, setUploadError] = createSignal<string | null>(null);
  const [activeCategory, setActiveCategory] = createSignal<AssetCategory>("all");
  const [viewMode, setViewMode] = createSignal<ViewMode>("grid");
  const [search, setSearch] = createSignal("");

  const [assets, { refetch }] = createResource(async () => {
    const client = apiStore.getClient();
    const res = await client.assetsList();
    return res.assets;
  });

  const categoryCounts = createMemo(() => {
    const list = assets() ?? [];
    const counts: Record<AssetCategory, number> = {
      all: list.length,
      image: 0,
      audio: 0,
      video: 0,
      font: 0,
      other: 0,
    };
    for (const a of list) {
      const cat = resolveAssetCategory(a);
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  });

  const handleUpload = async (file: File): Promise<void> => {
    setUploading(true);
    setUploadError(null);
    try {
      const ext = file.name.includes(".") ? (file.name.split(".").pop() ?? "").toLowerCase() : "";
      const cat = resolveAssetCategory({ fileType: file.type, path: file.name });
      const dir = CATEGORY_CONFIG[cat]?.dir ?? "assets";
      const key = `${dir}/${file.name}`;

      const client = apiStore.getClient();
      const presign = await client.presign({
        key,
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
        path: key,
        assetType: cat,
        fileType: file.type || ext || "application/octet-stream",
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

  const copyTag = async (asset: AssetIndexEntry): Promise<void> => {
    const cat = resolveAssetCategory(asset);
    let tag = "";
    if (cat === "image") {
      tag = `![${asset.path}](/${asset.path})`;
      await navigator.clipboard.writeText(tag);
      toast.success(tag, "已复制 Markdown 图片标签");
    } else if (cat === "audio") {
      tag = `<audio controls src="/${asset.path}"></audio>`;
      await navigator.clipboard.writeText(tag);
      toast.success(tag, "已复制音频播放标签");
    } else if (cat === "video") {
      tag = `<video controls src="/${asset.path}"></video>`;
      await navigator.clipboard.writeText(tag);
      toast.success(tag, "已复制视频播放标签");
    } else if (cat === "font") {
      tag = `url('/${asset.path}')`;
      await navigator.clipboard.writeText(tag);
      toast.success(tag, "已复制字体 CSS 路径");
    } else {
      tag = `[${asset.path}](/${asset.path})`;
      await navigator.clipboard.writeText(tag);
      toast.success(tag, "已复制 Markdown 链接");
    }
  };

  const copyPath = async (path: string): Promise<void> => {
    await navigator.clipboard.writeText(`/${path}`);
    toast.success(`/${path}`, "已复制路径");
  };

  const filteredAssets = createMemo(() => {
    const list = assets();
    if (!list) return undefined;
    const cat = activeCategory();
    const q = search().toLowerCase().trim();

    return list.filter((a) => {
      if (cat !== "all" && resolveAssetCategory(a) !== cat) {
        return false;
      }
      if (q.length > 0) {
        return a.path.toLowerCase().includes(q) || a.r2Key?.toLowerCase().includes(q);
      }
      return true;
    });
  });

  // 严格控制：非 image 分类只能列表查看；image 分类支持图库与列表切换
  const isImageOrAll = () => activeCategory() === "image" || activeCategory() === "all";
  const effectiveViewMode = () => {
    if (activeCategory() !== "image" && activeCategory() !== "all") {
      return "table";
    }
    return viewMode();
  };

  return (
    <div class="flex flex-col gap-6">
      <PageHeader
        title={t("assets.title")}
        description="管理存储在 Cloudflare R2 对象存储中的静态图片、音视频与字体等多媒体资产"
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

      {/* Category Tabs */}
      <Tabs
        activeKey={activeCategory()}
        onChange={(k) => {
          const next = k as AssetCategory;
          setActiveCategory(next);
          if (next !== "image" && next !== "all") {
            setViewMode("table");
          }
        }}
        items={[
          { key: "all", label: "全部", icon: "i-ri-apps-2-line", count: categoryCounts().all },
          { key: "image", label: "图片", icon: "i-ri-image-line", count: categoryCounts().image },
          { key: "audio", label: "音频", icon: "i-ri-music-2-line", count: categoryCounts().audio },
          { key: "video", label: "视频", icon: "i-ri-video-line", count: categoryCounts().video },
          { key: "font", label: "字体", icon: "i-ri-font-size", count: categoryCounts().font },
          ...(categoryCounts().other > 0
            ? [{ key: "other", label: "其他", icon: "i-ri-file-3-line", count: categoryCounts().other }]
            : []),
        ]}
      />

      {/* Filter and View Switcher Bar */}
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--surface)] p-3 border border-[var(--border)] rounded-[6px]">
        <Input
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          placeholder="搜索资产路径 / 文件名..."
          icon="i-ri-search-line"
          containerClass="max-w-xs flex-1"
        />

        <Show
          when={isImageOrAll()}
          fallback={
            <div class="flex items-center gap-1.5 text-xs text-[var(--muted)] px-2.5 py-1.5 bg-[var(--g-2)] rounded-[4px] border border-[var(--border)] self-start sm:self-auto select-none">
              <span class="i-ri-list-check text-sm" />
              <span>当前分类仅支持列表查看</span>
            </div>
          }
        >
          <SegmentedControl<ViewMode>
            value={viewMode()}
            onChange={setViewMode}
            size="sm"
            items={[
              { value: "grid", label: "网格图库", icon: "i-ri-layout-grid-line" },
              { value: "table", label: "列表", icon: "i-ri-list-check" },
            ]}
          />
        </Show>
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
                icon={
                  activeCategory() === "all"
                    ? "i-ri-folder-open-line"
                    : CATEGORY_CONFIG[activeCategory() as AssetType]?.icon ?? "i-ri-file-3-line"
                }
                title={
                  assets()?.length === 0
                    ? t("assets.empty")
                    : `暂无${activeCategory() === "all" ? "" : CATEGORY_CONFIG[activeCategory() as AssetType]?.label ?? ""}资产`
                }
                description={
                  assets()?.length === 0
                    ? "点击右上角「上传」把多媒体资产上传到 Cloudflare R2 存储"
                    : "请尝试切换分类或更换搜索关键字"
                }
              />
            }
          >
            {/* View Mode: Grid (Gallery) - 仅图片分类或全部下以卡片形式展示 */}
            <Show when={effectiveViewMode() === "grid"}>
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <For each={list()}>
                  {(asset) => {
                    const cat = resolveAssetCategory(asset);
                    const isImg = cat === "image";
                    const meta = CATEGORY_CONFIG[cat];

                    return (
                      <Card hoverable class="flex flex-col justify-between p-0 overflow-hidden group">
                        {/* Preview / Thumbnail Box */}
                        <div class="h-40 bg-[var(--g-2)] relative flex items-center justify-center overflow-hidden border-b border-[var(--border)]">
                          <Show
                            when={isImg}
                            fallback={
                              <div class="flex flex-col items-center gap-1 text-[var(--muted)]">
                                <span class={`${meta.icon} text-4xl`} />
                                <Badge variant={meta.badgeVariant} size="sm">
                                  {meta.label}
                                </Badge>
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
                          <div class="flex flex-col gap-1">
                            <div class="flex items-center gap-1.5">
                              <Badge variant={meta.badgeVariant} size="sm">
                                {meta.label}
                              </Badge>
                              <span
                                class="font-medium text-xs text-[var(--text)] truncate font-mono flex-1"
                                title={asset.path}
                              >
                                {asset.path}
                              </span>
                            </div>
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
                              onClick={() => void copyTag(asset)}
                            >
                              {cat === "image" ? "复制 MD" : "复制标签"}
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

            {/* View Mode: Table (所有非图片分类强制此模式，图片也支持切换此模式) */}
            <Show when={effectiveViewMode() === "table"}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow hoverable={false}>
                      <TableHeader class="w-[35%]">资产路径</TableHeader>
                      <TableHeader class="w-[12%]">分类</TableHeader>
                      <TableHeader class="w-[12%]">格式/类型</TableHeader>
                      <TableHeader class="w-[12%]">大小</TableHeader>
                      <TableHeader class="w-[15%]">R2 Key</TableHeader>
                      <TableHeader class="w-[10%]">更新日期</TableHeader>
                      <TableHeader class="w-[14%] text-right">操作</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <For each={list()}>
                      {(asset) => {
                        const cat = resolveAssetCategory(asset);
                        const meta = CATEGORY_CONFIG[cat];

                        return (
                          <TableRow>
                            <TableCell>
                              <div class="flex items-center gap-2">
                                <span class={`${meta.icon} text-[var(--muted)] text-base`} />
                                <span
                                  class="font-mono text-xs font-medium text-[var(--text)] truncate max-w-xs"
                                  title={asset.path}
                                >
                                  {asset.path}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell>
                              <Badge variant={meta.badgeVariant} size="sm">
                                {meta.label}
                              </Badge>
                            </TableCell>

                            <TableCell>
                              <span class="text-xs font-mono text-[var(--muted)]">
                                {asset.fileType}
                              </span>
                            </TableCell>

                            <TableCell>
                              <span class="text-xs font-mono text-[var(--text)]">
                                {formatBytes(asset.size)}
                              </span>
                            </TableCell>

                            <TableCell>
                              <span
                                class="font-mono text-xs text-[var(--muted)] truncate max-w-36 block"
                                title={asset.r2Key ?? ""}
                              >
                                {asset.r2Key ?? "—"}
                              </span>
                            </TableCell>

                            <TableCell>
                              <span class="text-xs text-[var(--muted)]">
                                {asset.updatedAt.slice(0, 10)}
                              </span>
                            </TableCell>

                            <TableCell class="text-right">
                              <div class="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="secondary"
                                  size="xs"
                                  icon="i-ri-code-s-slash-line"
                                  onClick={() => void copyTag(asset)}
                                  title={cat === "image" ? "复制 Markdown 图片标签" : "复制引用标签"}
                                >
                                  {cat === "image" ? "复制 MD" : "复制标签"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="xs"
                                  icon="i-ri-file-copy-line"
                                  onClick={() => void copyPath(asset.path)}
                                  title="复制路径"
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      }}
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
