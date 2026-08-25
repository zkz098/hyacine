import { createSignal, Show, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";
import { isTauri, gitVersion } from "../tauri/bridge";
import { projectStore } from "../store/project";
import type { ConfigUpdateRequest } from "@hyacine/contract";

interface CloudForm {
  aiEndpoint: string;
  aiModel: string;
  aiKey: string;
  embedModel: string;
  r2Endpoint: string;
  r2AccessKeyId: string;
  r2Secret: string;
  r2Bucket: string;
}

function emptyForm(): CloudForm {
  return {
    aiEndpoint: "",
    aiModel: "",
    aiKey: "",
    embedModel: "",
    r2Endpoint: "",
    r2AccessKeyId: "",
    r2Secret: "",
    r2Bucket: "",
  };
}

export function Settings(): import("solid-js").JSX.Element {
  const navigate = useNavigate();
  const [url, setUrl] = createSignal(apiStore.state.baseUrl);
  const [saved, setSaved] = createSignal(false);
  const [health, setHealth] = createSignal<{
    ok: boolean;
    version: string;
    needsSetup: boolean;
    ai: { summary: boolean; embed: boolean };
  } | null>(null);
  const [healthError, setHealthError] = createSignal<string | null>(null);
  const [healthLoading, setHealthLoading] = createSignal(false);

  const [theme, setThemeSignal] = createSignal(apiStore.state.theme);
  const [gitVer, setGitVer] = createSignal<string | null>(null);

  // 云端动态配置面板
  const [cloudForm, setCloudForm] = createSignal(emptyForm());
  const [cloudLoaded, setCloudLoaded] = createSignal(false);
  const [cloudKeySet, setCloudKeySet] = createSignal({ aiKey: false, r2Secret: false });
  const [cloudError, setCloudError] = createSignal<string | null>(null);
  const [cloudSaving, setCloudSaving] = createSignal(false);
  const [cloudSaved, setCloudSaved] = createSignal(false);

  const loadCloudConfig = async (): Promise<void> => {
    setCloudError(null);
    try {
      const cfg = await apiStore.getClient().getConfig();
      setCloudForm({
        aiEndpoint: cfg.aiSummary.endpoint,
        aiModel: cfg.aiSummary.model,
        aiKey: "",
        embedModel: cfg.embedModel,
        r2Endpoint: cfg.r2.endpoint,
        r2AccessKeyId: cfg.r2.accessKeyId,
        r2Secret: "",
        r2Bucket: cfg.r2.bucket,
      });
      setCloudKeySet({ aiKey: cfg.aiSummary.key.set, r2Secret: cfg.r2.secretAccessKey.set });
      setCloudLoaded(true);
    } catch (err: unknown) {
      setCloudError(`${t("settings.cloud.loadFailed")}${messageOf(err)}`);
    }
  };

  const handleCloudSave = async (): Promise<void> => {
    setCloudSaving(true);
    setCloudError(null);
    setCloudSaved(false);
    try {
      const f = cloudForm();
      const prev = await apiStore.getClient().getConfig();
      const update: ConfigUpdateRequest = {};
      const aiPatch: NonNullable<ConfigUpdateRequest["aiSummary"]> = {};
      if (f.aiEndpoint !== prev.aiSummary.endpoint) aiPatch.endpoint = f.aiEndpoint;
      if (f.aiModel !== prev.aiSummary.model) aiPatch.model = f.aiModel;
      if (f.aiKey.length > 0) aiPatch.key = f.aiKey;
      if (Object.keys(aiPatch).length > 0) update.aiSummary = aiPatch;
      if (f.embedModel !== prev.embedModel) update.embedModel = f.embedModel;
      const r2Patch: NonNullable<ConfigUpdateRequest["r2"]> = {};
      if (f.r2Endpoint !== prev.r2.endpoint) r2Patch.endpoint = f.r2Endpoint;
      if (f.r2AccessKeyId !== prev.r2.accessKeyId) r2Patch.accessKeyId = f.r2AccessKeyId;
      if (f.r2Secret.length > 0) r2Patch.secretAccessKey = f.r2Secret;
      if (f.r2Bucket !== prev.r2.bucket) r2Patch.bucket = f.r2Bucket;
      if (Object.keys(r2Patch).length > 0) update.r2 = r2Patch;
      await apiStore.getClient().updateConfig(update);
      setCloudSaved(true);
      setTimeout(() => setCloudSaved(false), 2000);
      await loadCloudConfig(); // 刷新已设置标志
    } catch (err: unknown) {
      setCloudError(messageOf(err));
    } finally {
      setCloudSaving(false);
    }
  };

  const setField = (key: keyof CloudForm, value: string): void => {
    setCloudForm((f) => ({ ...f, [key]: value }));
  };

  onMount(() => {
    if (isTauri()) {
      void gitVersion().then((v) => setGitVer(v));
    }
  });

  const handleSave = (): void => {
    apiStore.setBaseUrl(url().trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleTest = async (): Promise<void> => {
    setHealthLoading(true);
    setHealthError(null);
    setHealth(null);
    const prevUrl = apiStore.state.baseUrl;
    try {
      // 暂时用当前输入框的 url 做连通性测试，不提交持久化
      const testUrl = url().trim();
      if (testUrl !== prevUrl) apiStore.setBaseUrl(testUrl);
      const client = apiStore.getClient();
      const res = await client.health();
      setHealth(res);
    } catch (err: unknown) {
      setHealthError(messageOf(err));
    } finally {
      // 测试非破坏性：无论成败都恢复原 baseUrl，避免失败残留死 URL 且被持久化
      if (apiStore.state.baseUrl !== prevUrl) apiStore.setBaseUrl(prevUrl);
      setHealthLoading(false);
    }
  };

  const handleTheme = (next: "light" | "dark"): void => {
    setThemeSignal(next);
    apiStore.setTheme(next);
  };

  // oxlint-disable-next-line unicorn/consistent-function-scoping -- uses apiStore/navigate, keep inside
  const handleLogout = (): void => {
    apiStore.clearAuth();
    navigate("/login");
  };

  return (
    <div class="flex flex-col gap-4 max-w-lg">
      <h1 class="text-xl font-bold">{t("settings.title")}</h1>

      <div class="surface p-4 flex flex-col gap-3">
        <label class="flex flex-col gap-1 text-sm">
          <span>{t("settings.apiUrl")}</span>
          <input
            value={url()}
            onInput={(e) => setUrl(e.currentTarget.value)}
            placeholder="https://your-api.workers.dev"
            class="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
          />
        </label>
        <div class="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            class="px-4 py-2 rounded bg-[var(--accent)] text-white text-sm hover:bg-[var(--accent-hover)]"
          >
            {t("settings.save")}
          </button>
          <button
            type="button"
            onClick={() => void handleTest()}
            disabled={healthLoading()}
            class="px-4 py-2 rounded border border-[var(--border)] text-sm hover:bg-[var(--bg)] disabled:opacity-50"
          >
            {t("settings.test")}
          </button>
          <Show when={saved()}>
            <span class="text-sm text-[var(--ok)] self-center">{t("settings.saved")}</span>
          </Show>
        </div>
        <Show when={healthError() !== null}>
          <Alert variant="error">{healthError()}</Alert>
        </Show>
        <Show when={health()}>
          {(h) => (
            <Alert variant="info">
              <div class="text-xs flex flex-col gap-1">
                <span>
                  ok: {String(h().ok)} · version: {h().version}
                </span>
                <span>
                  ai.summary: {String(h().ai.summary)} · ai.embed: {String(h().ai.embed)}
                </span>
                <Show when={h().needsSetup}>
                  <span>needsSetup: true</span>
                </Show>
              </div>
            </Alert>
          )}
        </Show>
      </div>

      <div class="surface p-4 flex flex-col gap-3">
        <h2 class="font-semibold text-sm">{t("settings.theme")}</h2>
        <div class="flex gap-2">
          <button
            type="button"
            onClick={() => handleTheme("light")}
            class={`px-3 py-1.5 rounded border text-sm ${theme() === "light" ? "bg-[var(--accent)] text-white border-transparent" : "border-[var(--border)]"}`}
          >
            {t("settings.theme.light")}
          </button>
          <button
            type="button"
            onClick={() => handleTheme("dark")}
            class={`px-3 py-1.5 rounded border text-sm ${theme() === "dark" ? "bg-[var(--accent)] text-white border-transparent" : "border-[var(--border)]"}`}
          >
            {t("settings.theme.dark")}
          </button>
        </div>
      </div>

      <Show when={apiStore.isAuthed()}>
        <div class="surface p-4 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-sm">{t("settings.cloud.title")}</h2>
            <Show when={!cloudLoaded()}>
              <button
                type="button"
                onClick={() => void loadCloudConfig()}
                class="px-3 py-1.5 rounded border border-[var(--border)] text-sm"
              >
                {t("settings.test")}
              </button>
            </Show>
          </div>

          <Show when={cloudError() !== null}>
            <Alert variant="error">{cloudError()}</Alert>
            <Show when={!cloudLoaded()}>
              <button
                type="button"
                onClick={() => void loadCloudConfig()}
                class="self-start px-3 py-1.5 rounded border border-[var(--border)] text-sm"
              >
                {t("settings.test")}
              </button>
            </Show>
          </Show>

          <Show when={cloudLoaded()}>
            <div class="flex flex-col gap-3">
              <div class="flex flex-col gap-2">
                <h3 class="text-xs text-muted">{t("settings.cloud.ai")}</h3>
                <input
                  value={cloudForm().aiEndpoint}
                  onInput={(e) => setField("aiEndpoint", e.currentTarget.value)}
                  placeholder={t("settings.cloud.ai.endpoint")}
                  class="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                />
                <div class="flex gap-2">
                  <input
                    value={cloudForm().aiModel}
                    onInput={(e) => setField("aiModel", e.currentTarget.value)}
                    placeholder={t("settings.cloud.ai.model")}
                    class="flex-1 px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                  />
                  <input
                    value={cloudForm().aiKey}
                    onInput={(e) => setField("aiKey", e.currentTarget.value)}
                    type="password"
                    placeholder={`${t("settings.cloud.ai.key")}（${cloudKeySet().aiKey ? t("settings.cloud.keySet") : t("settings.cloud.keyUnset")}）`}
                    class="flex-1 px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                  />
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <h3 class="text-xs text-muted">嵌入</h3>
                <input
                  value={cloudForm().embedModel}
                  onInput={(e) => setField("embedModel", e.currentTarget.value)}
                  placeholder={t("settings.cloud.embedModel")}
                  class="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                />
              </div>

              <div class="flex flex-col gap-2">
                <h3 class="text-xs text-muted">{t("settings.cloud.r2")}</h3>
                <input
                  value={cloudForm().r2Endpoint}
                  onInput={(e) => setField("r2Endpoint", e.currentTarget.value)}
                  placeholder={t("settings.cloud.r2.endpoint")}
                  class="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                />
                <div class="flex gap-2">
                  <input
                    value={cloudForm().r2AccessKeyId}
                    onInput={(e) => setField("r2AccessKeyId", e.currentTarget.value)}
                    placeholder={t("settings.cloud.r2.accessKeyId")}
                    class="flex-1 px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                  />
                  <input
                    value={cloudForm().r2Secret}
                    onInput={(e) => setField("r2Secret", e.currentTarget.value)}
                    type="password"
                    placeholder={`${t("settings.cloud.r2.secret")}（${cloudKeySet().r2Secret ? t("settings.cloud.keySet") : t("settings.cloud.keyUnset")}）`}
                    class="flex-1 px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                  />
                </div>
                <input
                  value={cloudForm().r2Bucket}
                  onInput={(e) => setField("r2Bucket", e.currentTarget.value)}
                  placeholder={t("settings.cloud.r2.bucket")}
                  class="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                />
              </div>

              <div class="flex gap-2 items-center">
                <button
                  type="button"
                  disabled={cloudSaving()}
                  onClick={() => void handleCloudSave()}
                  class="px-4 py-2 rounded bg-[var(--accent)] text-white text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  {t("settings.cloud.save")}
                </button>
                <Show when={cloudSaved()}>
                  <span class="text-sm text-[var(--ok)]">{t("settings.cloud.saved")}</span>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      <div class="surface p-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleLogout}
          class="self-start px-4 py-2 rounded btn-danger text-sm"
        >
          {t("settings.logout")}
        </button>
        <p class="text-xs text-muted">{t("settings.version")}: 0.1.0</p>
      </div>

      <Show when={isTauri()}>
        <div class="surface p-4 flex flex-col gap-2">
          <h2 class="font-semibold text-sm">桌面</h2>
          <p class="text-xs text-muted">项目目录：{projectStore.projectDir() ?? "未选择"}</p>
          <p class="text-xs text-muted">Git：{gitVer() ?? "检测中..."}</p>
        </div>
      </Show>
    </div>
  );
}
