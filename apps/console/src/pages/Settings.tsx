import { createSignal, Show, onMount } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";
import { isTauri, gitVersion } from "../tauri/bridge";
import { projectStore } from "../store/project";
import {
  loadEnabledPlugins,
  notifyPluginsChanged,
  togglePluginEnabled,
} from "../editor/syntax/pluginSettings";
import { loadProjectSyntaxPlugins } from "../editor/syntax/projectPlugins";
import type { ConfigUpdateRequest } from "@hyacine/contract";

interface CloudForm {
  aiEndpoint: string;
  aiModel: string;
  aiKey: string;
  aiProvider: "byok" | "workers-ai";
  aiAutogen: boolean;
  embedModel: string;
  embedAutogen: boolean;
  ghOwner: string;
  ghRepo: string;
  ghToken: string;
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
    aiProvider: "byok",
    aiAutogen: false,
    embedModel: "",
    embedAutogen: false,
    ghOwner: "",
    ghRepo: "",
    ghToken: "",
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
  const [cloudKeySet, setCloudKeySet] = createSignal({
    aiKey: false,
    r2Secret: false,
    ghToken: false,
  });
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
        aiProvider: cfg.aiSummary.provider,
        aiAutogen: cfg.aiSummary.autogen,
        embedModel: cfg.embedModel,
        embedAutogen: cfg.embedAutogen,
        ghOwner: cfg.github.repoOwner,
        ghRepo: cfg.github.repoName,
        ghToken: "",
        r2Endpoint: cfg.r2.endpoint,
        r2AccessKeyId: cfg.r2.accessKeyId,
        r2Secret: "",
        r2Bucket: cfg.r2.bucket,
      });
      setCloudKeySet({
        aiKey: cfg.aiSummary.key.set,
        r2Secret: cfg.r2.secretAccessKey.set,
        ghToken: cfg.github.token.set,
      });
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
      if (f.aiProvider !== prev.aiSummary.provider) aiPatch.provider = f.aiProvider;
      if (f.aiAutogen !== prev.aiSummary.autogen) aiPatch.autogen = f.aiAutogen;
      if (Object.keys(aiPatch).length > 0) update.aiSummary = aiPatch;
      if (f.embedModel !== prev.embedModel) update.embedModel = f.embedModel;
      if (f.embedAutogen !== prev.embedAutogen) update.embedAutogen = f.embedAutogen;
      const ghPatch = {} as NonNullable<ConfigUpdateRequest["github"]>;
      if (f.ghOwner !== prev.github.repoOwner) ghPatch.repoOwner = f.ghOwner;
      if (f.ghRepo !== prev.github.repoName) ghPatch.repoName = f.ghRepo;
      if (f.ghToken.length > 0) ghPatch.token = f.ghToken;
      if (Object.keys(ghPatch).length > 0) update.github = ghPatch;
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

  const setField = (key: keyof CloudForm, value: string | boolean): void => {
    setCloudForm((f) => ({ ...f, [key]: value }));
  };

  // 语法插件设置（本地预览）
  const [pluginEnabledTick, setPluginEnabledTick] = createSignal(0);
  const [projectPluginNames, setProjectPluginNames] = createSignal<string[]>([]);
  const [projectPluginErrors, setProjectPluginErrors] = createSignal<string[]>([]);

  const refreshProjectPlugins = async (): Promise<void> => {
    const dir = projectStore.projectDir();
    if (dir === null) return;
    const result = await loadProjectSyntaxPlugins(dir);
    setProjectPluginNames(
      result.loaded.length > 0 ? result.loaded : result.plugins.map((p) => p.name),
    );
    setProjectPluginErrors(result.errors);
  };

  onMount(() => {
    if (isTauri()) {
      void gitVersion().then((v) => setGitVer(v));
      void refreshProjectPlugins();
    }
  });
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
                <div class="flex items-center gap-3 text-sm">
                  <label class="flex items-center gap-1">
                    <span class="text-muted">{t("settings.cloud.ai.provider")}</span>
                    <select
                      value={cloudForm().aiProvider}
                      onChange={(e) => {
                        const v = e.currentTarget.value;
                        setField("aiProvider", v === "workers-ai" ? "workers-ai" : "byok");
                      }}
                      class="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                    >
                      <option value="byok">OpenAI 兼容 (BYOK)</option>
                      <option value="workers-ai">Workers AI</option>
                    </select>
                  </label>
                  <label class="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cloudForm().aiAutogen}
                      onChange={(e) => setField("aiAutogen", e.currentTarget.checked)}
                    />
                    {t("settings.cloud.ai.autogen")}
                  </label>
                </div>
                {/* BYOK 专属：endpoint + key；Workers AI 只配模型名 */}
                <Show when={cloudForm().aiProvider === "byok"}>
                  <input
                    value={cloudForm().aiEndpoint}
                    onInput={(e) => setField("aiEndpoint", e.currentTarget.value)}
                    placeholder={t("settings.cloud.ai.endpoint")}
                    class="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                  />
                  <input
                    value={cloudForm().aiKey}
                    onInput={(e) => setField("aiKey", e.currentTarget.value)}
                    type="password"
                    placeholder={`${t("settings.cloud.ai.key")}（${cloudKeySet().aiKey ? t("settings.cloud.keySet") : t("settings.cloud.keyUnset")}）`}
                    class="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                  />
                </Show>
                <input
                  value={cloudForm().aiModel}
                  onInput={(e) => setField("aiModel", e.currentTarget.value)}
                  placeholder={
                    cloudForm().aiProvider === "workers-ai"
                      ? t("settings.cloud.ai.modelWorkers")
                      : t("settings.cloud.ai.model")
                  }
                  class="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                />
              </div>

              <div class="flex flex-col gap-2">
                <h3 class="text-xs text-muted">嵌入</h3>
                <input
                  value={cloudForm().embedModel}
                  onInput={(e) => setField("embedModel", e.currentTarget.value)}
                  placeholder={t("settings.cloud.embedModel")}
                  class="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                />
                <label class="flex items-center gap-1 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cloudForm().embedAutogen}
                    onChange={(e) => setField("embedAutogen", e.currentTarget.checked)}
                  />
                  {t("settings.cloud.embedAutogen")}
                </label>
              </div>

              <div class="flex flex-col gap-2">
                <h3 class="text-xs text-muted">Primary（GitHub 桥）</h3>
                <div class="flex gap-2">
                  <input
                    value={cloudForm().ghOwner}
                    onInput={(e) => setField("ghOwner", e.currentTarget.value)}
                    placeholder="仓库 Owner"
                    class="flex-1 px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                  />
                  <input
                    value={cloudForm().ghRepo}
                    onInput={(e) => setField("ghRepo", e.currentTarget.value)}
                    placeholder="仓库名（blog）"
                    class="flex-1 px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
                  />
                </div>
                <input
                  value={cloudForm().ghToken}
                  onInput={(e) => setField("ghToken", e.currentTarget.value)}
                  type="password"
                  placeholder={`GitHub PAT（留空保持不变）${cloudKeySet().ghToken ? `（${t("settings.cloud.keySet")}）` : ""}`}
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

      <div class="surface p-4 flex flex-col gap-3">
        <h2 class="font-semibold text-sm">语法插件（预览端）</h2>
        <p class="text-xs text-muted">
          内置 ShokaX 扩展语法已拆为插件；项目可在
          <code class="text-mono">.hyacine/plugins/*.js</code>里用
          <code class="text-mono">{"registerSyntaxPlugin({ ... })"}</code>{" "}
          注册自定义组件/CSS（本地代码，勿装不明来源插件）。
        </p>
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={pluginEnabledTick() >= 0 && loadEnabledPlugins().includes("shokax-basic")}
            onChange={(e) => {
              togglePluginEnabled("shokax-basic", e.currentTarget.checked);
              setPluginEnabledTick((v) => v + 1);
              notifyPluginsChanged();
            }}
          />
          <span>
            shokax-basic（Note 卡片 / code-group / span / ruby / spoiler / ++插入++ / Quiz / Tabs）
          </span>
        </label>
        <Show when={isTauri()}>
          <div class="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshProjectPlugins()}
              class="px-3 py-1.5 rounded border border-[var(--border)] text-sm"
            >
              重新扫描项目插件
            </button>
            <span class="text-xs text-muted">
              {projectPluginNames().length > 0
                ? `已加载：${projectPluginNames().join(", ")}`
                : "未发现 .hyacine/plugins/*.js"}
            </span>
          </div>
          <Show when={projectPluginErrors().length > 0}>
            <Alert variant="warning">{projectPluginErrors().join(" | ")}</Alert>
          </Show>
        </Show>
      </div>

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
