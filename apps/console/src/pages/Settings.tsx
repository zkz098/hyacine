import { createSignal, Show, onMount, For } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { t } from "../i18n";
import { apiStore } from "../store/api";
import { messageOf } from "../store/errors";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/Card";
import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { Tabs } from "../components/Tabs";
import { isTauri, gitVersion } from "../tauri/bridge";
import { projectStore } from "../store/project";
import {
  loadEnabledPlugins,
  notifyPluginsChanged,
  togglePluginEnabled,
} from "../editor/syntax/pluginSettings";
import { loadProjectSyntaxPlugins } from "../editor/syntax/projectPlugins";
import type { ConfigUpdateRequest } from "@hyacine/contract";
import { toast } from "../components/Toast";

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

type SettingsTab = "api" | "cloud" | "plugins" | "system";

export function Settings(): import("solid-js").JSX.Element {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = createSignal<SettingsTab>("api");

  const [url, setUrl] = createSignal(apiStore.state.baseUrl);
  const [health, setHealth] = createSignal<{
    ok: boolean;
    version: string;
    needsSetup: boolean;
    ai: { summary: boolean; embed: boolean };
  } | null>(null);
  const [healthError, setHealthError] = createSignal<string | null>(null);
  const [healthLoading, setHealthLoading] = createSignal(false);

  const [theme, setThemeSignal] = createSignal(apiStore.state.theme);
  const [gitVer, setGitVer] = createSignal<string>("检测中...");
  const [checkingGit, setCheckingGit] = createSignal(false);

  const checkGit = async (): Promise<void> => {
    if (!isTauri()) {
      setGitVer("Web 模式不可用");
      return;
    }
    setCheckingGit(true);
    try {
      const v = await gitVersion();
      if (v !== null && v.trim().length > 0) {
        setGitVer(v.trim());
      } else {
        setGitVer("未检测到 Git（请确保已安装 Git 并配置到环境变量 PATH）");
      }
    } catch (err: unknown) {
      setGitVer(`检测失败: ${messageOf(err)}`);
    } finally {
      setCheckingGit(false);
    }
  };

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
      toast.success(t("settings.cloud.saved"));
      await loadCloudConfig();
    } catch (err: unknown) {
      setCloudError(messageOf(err));
      toast.error(messageOf(err), "保存云端配置失败");
    } finally {
      setCloudSaving(false);
    }
  };

  const setField = (key: keyof CloudForm, value: string | boolean): void => {
    setCloudForm((f) => ({ ...f, [key]: value }));
  };

  // 语法插件设置
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
      void checkGit();
      void refreshProjectPlugins();
    }
    if (apiStore.isAuthed()) {
      void loadCloudConfig();
    }
  });

  const handleSave = (): void => {
    apiStore.setBaseUrl(url().trim());
    toast.success(t("settings.saved"));
  };

  const handleTest = async (): Promise<void> => {
    setHealthLoading(true);
    setHealthError(null);
    setHealth(null);
    const prevUrl = apiStore.state.baseUrl;
    try {
      const testUrl = url().trim();
      if (testUrl !== prevUrl) apiStore.setBaseUrl(testUrl);
      const client = apiStore.getClient();
      const res = await client.health();
      setHealth(res);
      toast.success(`连接正常 · 版本 ${res.version}`);
    } catch (err: unknown) {
      setHealthError(messageOf(err));
      toast.error(messageOf(err), "测试连接失败");
    } finally {
      if (apiStore.state.baseUrl !== prevUrl) apiStore.setBaseUrl(prevUrl);
      setHealthLoading(false);
    }
  };

  const handleTheme = (next: "light" | "dark"): void => {
    setThemeSignal(next);
    apiStore.setTheme(next);
    toast.info(`已切换至${next === "dark" ? "暗色" : "亮色"}主题`);
  };

  const handleLogout = (): void => {
    apiStore.clearAuth();
    navigate("/login");
  };

  return (
    <div class="flex flex-col gap-6 max-w-4xl">
      <PageHeader
        title={t("settings.title")}
        description="管理系统网络连接、云端动态参数、ShokaX 语法扩展及外观偏好"
      />

      {/* Settings Navigation Tabs */}
      <Tabs
        activeKey={activeTab()}
        onChange={(k) => setActiveTab(k as SettingsTab)}
        items={[
          { key: "api", label: "连接与外观", icon: "i-ri-global-line" },
          {
            key: "cloud",
            label: "云端动态配置",
            icon: "i-ri-cloud-line",
            disabled: !apiStore.isAuthed(),
          },
          { key: "plugins", label: "语法插件", icon: "i-ri-puzzle-line" },
          { key: "system", label: "关于与桌面", icon: "i-ri-information-line" },
        ]}
      />

      {/* Tab 1: API & Theme */}
      <Show when={activeTab() === "api"}>
        <div class="flex flex-col gap-5">
          <Card class="flex flex-col gap-4">
            <CardHeader>
              <div>
                <CardTitle>API 服务连接</CardTitle>
                <CardDescription>配置 Cloudflare Worker API 端点地址</CardDescription>
              </div>
            </CardHeader>

            <Input
              label={t("settings.apiUrl")}
              value={url()}
              onInput={(e) => setUrl(e.currentTarget.value)}
              placeholder="https://your-api.workers.dev"
              icon="i-ri-links-line"
            />

            <div class="flex items-center gap-2.5 pt-1">
              <Button variant="primary" size="sm" icon="i-ri-save-line" onClick={handleSave}>
                {t("settings.save")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                loading={healthLoading()}
                icon="i-ri-wifi-line"
                onClick={() => void handleTest()}
              >
                {t("settings.test")}
              </Button>
            </div>

            <Show when={healthError() !== null}>
              <Alert variant="error" title="连接失败">
                {healthError()}
              </Alert>
            </Show>

            <Show when={health()}>
              {(h) => (
                <Alert variant="info" title="服务健康状态 (Health)">
                  <div class="text-xs flex flex-col gap-1 font-mono">
                    <span>
                      状态: {h().ok ? "正常 (OK)" : "异常"} · 版本: {h().version}
                    </span>
                    <span>
                      AI 摘要: {String(h().ai.summary)} · AI 向量嵌入: {String(h().ai.embed)}
                    </span>
                    <Show when={h().needsSetup}>
                      <span class="text-[var(--danger)]">需要初始化 SETUP_CODE</span>
                    </Show>
                  </div>
                </Alert>
              )}
            </Show>
          </Card>

          {/* Theme Settings */}
          <Card class="flex flex-col gap-3">
            <CardHeader>
              <div>
                <CardTitle>{t("settings.theme")}</CardTitle>
                <CardDescription>选择管理台界面亮暗色色彩模式</CardDescription>
              </div>
            </CardHeader>

            <div class="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleTheme("light")}
                class={`flex-1 flex items-center justify-center gap-2 p-3 rounded-[6px] border text-xs font-medium transition-all cursor-pointer ${
                  theme() === "light"
                    ? "border-[var(--accent)] bg-[var(--note-primary-bg)] text-[var(--accent)] font-semibold shadow-xs"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--g-1)]"
                }`}
              >
                <span class="i-ri-sun-line text-base" />
                <span>{t("settings.theme.light")}</span>
              </button>

              <button
                type="button"
                onClick={() => handleTheme("dark")}
                class={`flex-1 flex items-center justify-center gap-2 p-3 rounded-[6px] border text-xs font-medium transition-all cursor-pointer ${
                  theme() === "dark"
                    ? "border-[var(--accent)] bg-[var(--note-primary-bg)] text-[var(--accent)] font-semibold shadow-xs"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--g-1)]"
                }`}
              >
                <span class="i-ri-moon-line text-base" />
                <span>{t("settings.theme.dark")}</span>
              </button>
            </div>
          </Card>
        </div>
      </Show>

      {/* Tab 2: Cloud Config */}
      <Show when={activeTab() === "cloud"}>
        <div class="flex flex-col gap-5">
          <Card class="flex flex-col gap-5">
            <CardHeader>
              <div>
                <CardTitle>{t("settings.cloud.title")}</CardTitle>
                <CardDescription>
                  配置云端 AI 服务提供商、GitHub 桥接导出及 R2 对象存储参数（即时生效，免重新部署）
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="xs"
                icon="i-ri-refresh-line"
                onClick={() => void loadCloudConfig()}
              >
                重新加载
              </Button>
            </CardHeader>

            <Show when={cloudError() !== null}>
              <Alert variant="error">{cloudError()}</Alert>
            </Show>

            <Show when={cloudLoaded()}>
              {/* Section: AI Summary */}
              <div class="flex flex-col gap-3 pb-4 border-b border-[var(--border)]">
                <div class="flex items-center gap-2">
                  <span class="i-ri-sparkling-fill text-[var(--accent)]" />
                  <span class="font-semibold text-xs text-[var(--text)]">
                    {t("settings.cloud.ai")}
                  </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label={t("settings.cloud.ai.provider")}
                    value={cloudForm().aiProvider}
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      setField("aiProvider", v === "workers-ai" ? "workers-ai" : "byok");
                    }}
                    options={[
                      { label: "OpenAI 兼容协议 (BYOK)", value: "byok" },
                      { label: "Cloudflare Workers AI", value: "workers-ai" },
                    ]}
                  />

                  <div class="flex flex-col justify-end">
                    <label class="flex items-center gap-2 text-xs font-medium cursor-pointer py-2">
                      <input
                        type="checkbox"
                        checked={cloudForm().aiAutogen}
                        onChange={(e) => setField("aiAutogen", e.currentTarget.checked)}
                        class="rounded text-[var(--accent)]"
                      />
                      <span>{t("settings.cloud.ai.autogen")}</span>
                    </label>
                  </div>
                </div>

                <Show when={cloudForm().aiProvider === "byok"}>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label={t("settings.cloud.ai.endpoint")}
                      value={cloudForm().aiEndpoint}
                      onInput={(e) => setField("aiEndpoint", e.currentTarget.value)}
                      placeholder="https://api.openai.com/v1/chat/completions"
                    />
                    <Input
                      label={`${t("settings.cloud.ai.key")} (${cloudKeySet().aiKey ? "已设置" : "未设置"})`}
                      value={cloudForm().aiKey}
                      onInput={(e) => setField("aiKey", e.currentTarget.value)}
                      type="password"
                      placeholder="留空保持现有 Key 不变"
                    />
                  </div>
                </Show>

                <Input
                  label="摘要模型名称"
                  value={cloudForm().aiModel}
                  onInput={(e) => setField("aiModel", e.currentTarget.value)}
                  placeholder={
                    cloudForm().aiProvider === "workers-ai"
                      ? "@cf/meta/llama-3.2-3b-instruct"
                      : "gpt-4o-mini / deepseek-chat"
                  }
                />
              </div>

              {/* Section: Vector Embeddings */}
              <div class="flex flex-col gap-3 pb-4 border-b border-[var(--border)]">
                <div class="flex items-center gap-2">
                  <span class="i-ri-node-tree text-[var(--accent)]" />
                  <span class="font-semibold text-xs text-[var(--text)]">
                    向量嵌入 (Vector Embeddings)
                  </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={t("settings.cloud.embedModel")}
                    value={cloudForm().embedModel}
                    onInput={(e) => setField("embedModel", e.currentTarget.value)}
                    placeholder="@cf/baai/bge-large-en-v1.5"
                  />
                  <div class="flex flex-col justify-end">
                    <label class="flex items-center gap-2 text-xs font-medium cursor-pointer py-2">
                      <input
                        type="checkbox"
                        checked={cloudForm().embedAutogen}
                        onChange={(e) => setField("embedAutogen", e.currentTarget.checked)}
                        class="rounded text-[var(--accent)]"
                      />
                      <span>{t("settings.cloud.embedAutogen")}</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Section: Primary GitHub Bridge */}
              <div class="flex flex-col gap-3 pb-4 border-b border-[var(--border)]">
                <div class="flex items-center gap-2">
                  <span class="i-ri-github-fill text-[var(--text)]" />
                  <span class="font-semibold text-xs text-[var(--text)]">
                    Primary 模式 (GitHub 桥接)
                  </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="仓库拥有者 (Owner)"
                    value={cloudForm().ghOwner}
                    onInput={(e) => setField("ghOwner", e.currentTarget.value)}
                    placeholder="your-github-username"
                  />
                  <Input
                    label="仓库名称 (Repo)"
                    value={cloudForm().ghRepo}
                    onInput={(e) => setField("ghRepo", e.currentTarget.value)}
                    placeholder="my-blog"
                  />
                </div>
                <Input
                  label={`GitHub 个人访问令牌 (PAT) ${cloudKeySet().ghToken ? "(已设置)" : "(未设置)"}`}
                  value={cloudForm().ghToken}
                  onInput={(e) => setField("ghToken", e.currentTarget.value)}
                  type="password"
                  placeholder="ghp_xxx (留空保持不变)"
                />
              </div>

              {/* Section: R2 Storage */}
              <div class="flex flex-col gap-3">
                <div class="flex items-center gap-2">
                  <span class="i-ri-database-2-line text-[var(--accent)]" />
                  <span class="font-semibold text-xs text-[var(--text)]">
                    {t("settings.cloud.r2")}
                  </span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={t("settings.cloud.r2.endpoint")}
                    value={cloudForm().r2Endpoint}
                    onInput={(e) => setField("r2Endpoint", e.currentTarget.value)}
                    placeholder="https://<accountid>.r2.cloudflarestorage.com"
                  />
                  <Input
                    label={t("settings.cloud.r2.bucket")}
                    value={cloudForm().r2Bucket}
                    onInput={(e) => setField("r2Bucket", e.currentTarget.value)}
                    placeholder="blog-assets"
                  />
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={t("settings.cloud.r2.accessKeyId")}
                    value={cloudForm().r2AccessKeyId}
                    onInput={(e) => setField("r2AccessKeyId", e.currentTarget.value)}
                    placeholder="R2 Access Key ID"
                  />
                  <Input
                    label={`${t("settings.cloud.r2.secret")} (${cloudKeySet().r2Secret ? "已设置" : "未设置"})`}
                    value={cloudForm().r2Secret}
                    onInput={(e) => setField("r2Secret", e.currentTarget.value)}
                    type="password"
                    placeholder="留空保持不变"
                  />
                </div>
              </div>

              <div class="pt-3">
                <Button
                  variant="primary"
                  size="md"
                  loading={cloudSaving()}
                  icon="i-ri-save-line"
                  onClick={() => void handleCloudSave()}
                >
                  {t("settings.cloud.save")}
                </Button>
              </div>
            </Show>
          </Card>
        </div>
      </Show>

      {/* Tab 3: Syntax Plugins */}
      <Show when={activeTab() === "plugins"}>
        <div class="flex flex-col gap-5">
          <Card class="flex flex-col gap-4">
            <CardHeader>
              <div>
                <CardTitle>ShokaX 语法扩展插件</CardTitle>
                <CardDescription>
                  控制 Satteri 渲染管线所启用的语法插件与项目自定义扩展组件
                </CardDescription>
              </div>
            </CardHeader>

            <div class="p-3 rounded-[6px] bg-[var(--g-1)] border border-[var(--border)] flex flex-col gap-2">
              <label class="flex items-center gap-2.5 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    pluginEnabledTick() >= 0 && loadEnabledPlugins().includes("shokax-basic")
                  }
                  onChange={(e) => {
                    togglePluginEnabled("shokax-basic", e.currentTarget.checked);
                    setPluginEnabledTick((v) => v + 1);
                    notifyPluginsChanged();
                    toast.info("已更新插件启用配置");
                  }}
                  class="rounded text-[var(--accent)]"
                />
                <span>shokax-basic 内置扩展语法</span>
              </label>
              <p class="text-[11px] text-[var(--muted)] pl-6">
                包含 Note 语义卡片、code-group 代码分组、span/ruby 注音、spoiler
                黑幕剧透、++插入强调++、Quiz 测验及 Tabs 标签卡片。
              </p>
            </div>

            <Show when={isTauri()}>
              <div class="flex flex-col gap-2.5 pt-2 border-t border-[var(--border)]">
                <div class="flex items-center justify-between">
                  <span class="font-semibold text-xs text-[var(--text)]">
                    项目级自定义插件 (.hyacine/plugins/*.js)
                  </span>
                  <Button
                    variant="outline"
                    size="xs"
                    icon="i-ri-refresh-line"
                    onClick={() => void refreshProjectPlugins()}
                  >
                    重新扫描
                  </Button>
                </div>

                <div class="text-xs text-[var(--muted)]">
                  {projectPluginNames().length > 0 ? (
                    <div class="flex flex-wrap gap-1.5 pt-1">
                      <For each={projectPluginNames()}>
                        {(name) => <Badge variant="success">{name}</Badge>}
                      </For>
                    </div>
                  ) : (
                    <p class="text-[11px]">未发现 .hyacine/plugins/*.js 自定义插件</p>
                  )}
                </div>

                <Show when={projectPluginErrors().length > 0}>
                  <Alert variant="warning" title="插件加载警告">
                    {projectPluginErrors().join(" | ")}
                  </Alert>
                </Show>
              </div>
            </Show>
          </Card>
        </div>
      </Show>

      {/* Tab 4: System & About */}
      <Show when={activeTab() === "system"}>
        <div class="flex flex-col gap-5">
          <Card class="flex flex-col gap-4">
            <CardHeader>
              <div>
                <CardTitle>环境与版本信息</CardTitle>
                <CardDescription>当前运行环境与依赖状态</CardDescription>
              </div>
              <Badge variant="primary">v0.1.0</Badge>
            </CardHeader>

            <div class="flex flex-col gap-2 text-xs">
              <div class="flex items-center justify-between p-2.5 bg-[var(--g-1)] rounded-[4px] border border-[var(--border)]">
                <span class="text-[var(--muted)]">运行模式</span>
                <span class="font-semibold font-mono">
                  {isTauri() ? "Tauri 桌面端" : "Web 浏览器端"}
                </span>
              </div>

              <Show when={isTauri()}>
                <div class="flex items-center justify-between p-2.5 bg-[var(--g-1)] rounded-[4px] border border-[var(--border)]">
                  <span class="text-[var(--muted)]">本地项目目录</span>
                  <span class="font-mono truncate max-w-sm">
                    {projectStore.projectDir() ?? "未选择"}
                  </span>
                </div>

                <div class="flex items-center justify-between p-2.5 bg-[var(--g-1)] rounded-[4px] border border-[var(--border)] gap-2">
                  <span class="text-[var(--muted)] shrink-0">Git 环境</span>
                  <div class="flex items-center gap-2 font-mono truncate">
                    <span class="truncate">{gitVer()}</span>
                    <Button
                      variant="ghost"
                      size="xs"
                      icon="i-ri-refresh-line"
                      loading={checkingGit()}
                      onClick={() => void checkGit()}
                      title="重新检测 Git 环境"
                    />
                  </div>
                </div>
              </Show>
            </div>

            <div class="pt-2">
              <Button
                variant="danger"
                size="sm"
                icon="i-ri-logout-box-r-line"
                onClick={handleLogout}
              >
                {t("settings.logout")}
              </Button>
            </div>
          </Card>
        </div>
      </Show>
    </div>
  );
}
