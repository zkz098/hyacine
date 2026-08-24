import { createResource, createSignal, For, Show } from "solid-js";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";

export function Assets(): import("solid-js").JSX.Element {
  const [uploading, setUploading] = createSignal(false);
  const [uploadError, setUploadError] = createSignal<string | null>(null);
  const [uploadOk, setUploadOk] = createSignal<string | null>(null);

  const [assets, { refetch }] = createResource(async () => {
    const client = apiStore.getClient();
    const res = await client.assetsList();
    return res.assets;
  });

  const handleUpload = async (file: File): Promise<void> => {
    setUploading(true);
    setUploadError(null);
    setUploadOk(null);
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
      setUploadOk(file.name);
      await refetch();
    } catch (err: unknown) {
      setUploadError(messageOf(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">{t("assets.title")}</h1>
        <label class="px-3 py-1.5 rounded bg-[var(--accent)] text-white text-sm cursor-pointer hover:bg-[var(--accent-hover)]">
          {uploading() ? t("assets.uploading") : t("assets.upload")}
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
      </div>

      <Show when={uploadError() !== null}>
        <Alert variant="error">{uploadError()}</Alert>
      </Show>
      <Show when={uploadOk() !== null}>
        <Alert variant="info">已上传 {uploadOk()}</Alert>
      </Show>

      <Show when={assets.error}>
        <Alert variant="error">{messageOf(assets.error)}</Alert>
      </Show>
      <Show when={assets.loading}>
        <p class="text-sm text-muted">{t("common.loading")}</p>
      </Show>
      <Show when={assets()}>
        {(list) => (
          <Show
            when={list().length > 0}
            fallback={<p class="text-sm text-muted">{t("assets.empty")}</p>}
          >
            <div class="surface overflow-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-[var(--border)] text-left text-xs text-muted">
                    <th class="px-3 py-2">路径</th>
                    <th class="px-3 py-2">类型</th>
                    <th class="px-3 py-2">大小</th>
                    <th class="px-3 py-2">r2Key</th>
                    <th class="px-3 py-2">更新</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={list()}>
                    {(asset) => (
                      <tr class="border-b border-[var(--border)] last:border-0">
                        <td class="px-3 py-2">{asset.path}</td>
                        <td class="px-3 py-2 text-muted">
                          {asset.assetType}/{asset.fileType}
                        </td>
                        <td class="px-3 py-2 text-xs text-muted">
                          {asset.size !== null && asset.size !== undefined
                            ? String(asset.size)
                            : "—"}
                        </td>
                        <td class="px-3 py-2 text-xs text-muted truncate max-w-40">
                          {asset.r2Key ?? "—"}
                        </td>
                        <td class="px-3 py-2 text-xs text-muted">{asset.updatedAt.slice(0, 10)}</td>
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
