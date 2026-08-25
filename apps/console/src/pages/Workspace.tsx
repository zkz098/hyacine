import { For, Show } from "solid-js";
import { t } from "../i18n";
import { isTauri, openFolderDialog } from "../tauri/bridge";
import { projectStore } from "../store/project";
import { useNavigate } from "@solidjs/router";
import { Alert } from "../components/Alert";

export function Workspace(): import("solid-js").JSX.Element {
  const navigate = useNavigate();

  // oxlint-disable-next-line unicorn/consistent-function-scoping -- captures navigate, keep inside component
  const handleOpen = async (): Promise<void> => {
    const dir = await openFolderDialog();
    if (dir === null) return;
    await projectStore.openProject(dir);
  };

  const handleEdit = (path: string): void => {
    navigate(`/editor?path=${encodeURIComponent(path)}`);
  };

  const handleNew = async (): Promise<void> => {
    const dir = projectStore.projectDir();
    if (dir === null) return;
    const title = `新文章-${new Date().toISOString().slice(0, 10)}`;
    // 标题全无 [a-z0-9] 时兜底成唯一 slug，避免生成 "-" 或空文件名
    const slugBase = title.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const slug = slugBase.length > 0 ? slugBase : `post-${Date.now()}`;
    const content = `---\ntitle: ${title}\nslug: ${slug}\n\ndate: ${new Date().toISOString().slice(0, 10)}\ncategories: []\ndraft: true\n---\n\n正文...\n`;
    const cfg = projectStore.projectConfig();
    const contentDir = cfg?.contentDir ?? "src/posts";
    // 尊重项目声明的 postExtension（astro-blog 支持 .mdx），默认 .md
    const ext = cfg?.postExtension?.[0] ?? ".md";
    const full = `${dir}/${contentDir}/${slug}${ext}`;
    const { writeTextFile } = await import("../tauri/bridge");
    await writeTextFile(full, content);
    await projectStore.refreshPosts();
    handleEdit(`${slug}${ext}`);
  };

  return (
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">{t("workspace.title")}</h1>
        <Show when={isTauri()}>
          <button
            type="button"
            onClick={() => void handleOpen()}
            class="px-3 py-1.5 rounded bg-[var(--accent)] text-white text-sm hover:bg-[var(--accent-hover)]"
          >
            <span class="i-ri-folder-open-line mr-1" />
            {t("workspace.open")}
          </button>
        </Show>
      </div>

      <Show when={!isTauri()}>
        <Alert variant="info">{t("workspace.requireTauri")}</Alert>
      </Show>

      <Show when={isTauri() && projectStore.projectDir() === null}>
        <div class="surface p-8 flex flex-col items-center gap-3">
          <p class="text-sm text-muted">{t("workspace.empty")}</p>
          <button
            type="button"
            onClick={() => void handleOpen()}
            class="px-4 py-2 rounded bg-[var(--accent)] text-white text-sm"
          >
            {t("workspace.open")}
          </button>
        </div>
      </Show>

      <Show when={projectStore.projectDir() !== null}>
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2 text-sm">
            <span class="text-muted">{t("workspace.project")}:</span>
            <span class="font-mono text-xs bg-[var(--surface)] border border-[var(--border)] px-2 py-1 rounded">
              {projectStore.projectDir()}
            </span>
            <button
              type="button"
              onClick={() => void projectStore.refreshPosts()}
              class="ml-auto px-2 py-1 rounded border border-[var(--border)] text-xs hover:bg-[var(--surface)]"
            >
              <span class="i-ri-refresh-line mr-1" />
              {t("common.refresh")}
            </button>
            <button
              type="button"
              onClick={() => void handleNew()}
              class="px-3 py-1.5 rounded bg-[var(--accent)] text-white text-xs hover:bg-[var(--accent-hover)]"
            >
              <span class="i-ri-add-line mr-1" />
              {t("workspace.new")}
            </button>
          </div>

          <Show when={projectStore.error() !== null}>
            <Alert variant="error">{projectStore.error()}</Alert>
          </Show>

          <Show when={projectStore.loading()}>
            <p class="text-sm text-muted">{t("common.loading")}</p>
          </Show>

          <Show when={!projectStore.loading() && projectStore.posts().length === 0}>
            <p class="text-sm text-muted">{t("workspace.noPosts")}</p>
          </Show>

          <div class="surface overflow-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-[var(--border)] text-left text-xs text-muted">
                  <th class="px-3 py-2">标题</th>
                  <th class="px-3 py-2">slug</th>
                  <th class="px-3 py-2">状态</th>
                  <th class="px-3 py-2">摘要</th>
                  <th class="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                <For each={projectStore.posts()}>
                  {(post) => (
                    <tr class="border-b border-[var(--border)] last:border-0">
                      <td class="px-3 py-2">{post.title}</td>
                      <td class="px-3 py-2 text-muted text-xs">{post.slug}</td>
                      <td class="px-3 py-2">
                        {post.draft ? (
                          <span class="chip chip-warning">草稿</span>
                        ) : (
                          <span class="chip chip-success">已发布</span>
                        )}
                      </td>
                      <td class="px-3 py-2 text-xs">
                        {post.summaryPresent ? (
                          <span class="text-[var(--ok)]">✓</span>
                        ) : (
                          <span class="text-muted">—</span>
                        )}
                      </td>
                      <td class="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(post.path)}
                          class="px-2 py-1 rounded border border-[var(--border)] text-xs hover:bg-[var(--bg)]"
                        >
                          {t("workspace.edit")}
                        </button>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </Show>
    </div>
  );
}
