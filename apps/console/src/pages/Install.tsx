import { createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { t } from "../i18n";
import {
  isTauri,
  openFolderDialog,
  runShell,
  shellVersion,
  exists,
  readTextFile,
  isEmptyDir,
} from "../tauri/bridge";
import {
  DEFAULT_BLOG_REPO,
  CLONE_SOURCES,
  resolveCloneUrl,
  resolveCloneTarget,
  type CloneSource,
} from "../lib/install";
import { projectStore } from "../store/project";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/Card";
import { PageHeader } from "../components/PageHeader";
import { toast } from "../components/Toast";

type StepStatus = "wait" | "process" | "success" | "error";

interface Step {
  title: string;
  description: string;
  status: StepStatus;
  error: string;
}

const initialSteps = (): Step[] => [
  { title: "检查依赖", description: "检查 Git、pnpm 等必要工具", status: "process", error: "" },
  { title: "克隆仓库", description: "拉取 Astro ShokaX 源码模板", status: "wait", error: "" },
  { title: "安装依赖", description: "执行 pnpm install（可选跳过）", status: "wait", error: "" },
  { title: "初始化完成", description: "在工作台中打开并开始创作", status: "wait", error: "" },
];

const LOG_LIMIT = 60;

export function Install(): import("solid-js").JSX.Element {
  const navigate = useNavigate();

  const [steps, setSteps] = createSignal<Step[]>(initialSteps());
  const [repo, setRepo] = createSignal(DEFAULT_BLOG_REPO);
  const [source, setSource] = createSignal<CloneSource>("github");
  const [targetDir, setTargetDir] = createSignal<string | null>(null);
  const [projectDir, setProjectDir] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);
  const [logs, setLogs] = createSignal<string[]>([]);
  const [deps, setDeps] = createSignal<{ git: string | null; pnpm: string | null }>({
    git: null,
    pnpm: null,
  });

  const patchStep = (index: number, patch: Partial<Step>): void => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const pushLog = (line: string): void => {
    setLogs((prev) => [...prev.slice(-LOG_LIMIT), line]);
  };

  const checkDeps = async (): Promise<void> => {
    patchStep(0, { status: "process", error: "" });
    const [git, pnpm] = await Promise.all([shellVersion("git"), shellVersion("pnpm")]);
    setDeps({ git, pnpm });
    pushLog(`git: ${git ?? "缺失"}`);
    pushLog(`pnpm: ${pnpm ?? "缺失"}`);
    if (git === null) {
      patchStep(0, { status: "error", error: "未检测到 Git，请先安装并加入 PATH 环境变量。" });
      return;
    }
    patchStep(0, { status: "success" });
    toast.success("环境依赖检查通过");
  };

  const chooseDir = async (): Promise<void> => {
    if (!isTauri()) return;
    const dir = await openFolderDialog();
    if (dir === null) return;
    setTargetDir(dir);
  };

  const runClone = async (): Promise<void> => {
    if (!isTauri()) return;
    const dir = targetDir();
    if (dir === null) {
      patchStep(1, { status: "error", error: "请先选择目标目录。" });
      return;
    }
    const url = resolveCloneUrl(repo(), source());
    if (url.length === 0) {
      patchStep(1, { status: "error", error: "仓库地址为空。" });
      return;
    }
    setBusy(true);
    patchStep(1, { status: "process", error: "" });
    pushLog(`克隆源: ${url}`);
    try {
      const target = await resolveCloneTarget(dir, "astro-blog-shokax", async (p) => {
        if (!(await exists(p))) return false;
        if (p === dir) return !(await isEmptyDir(p));
        return true;
      });
      setProjectDir(target);
      pushLog(`目标目录: ${target}`);
      const r = await runShell(
        "git",
        ["clone", "--depth", "1", url, target],
        target === dir ? dir : dir,
      );
      pushLog(r.stdout || r.stderr);
      if (r.code !== 0) {
        patchStep(1, { status: "error", error: r.stderr || r.stdout || "git clone 失败" });
        return;
      }
      const hasConfig = await exists(`${target}/hyacine.yml`);
      if (!hasConfig) {
        patchStep(1, {
          status: "error",
          error: "克隆成功但缺少 hyacine.yml，请确认模板仓库正确。",
        });
        return;
      }
      const configPreview = (await readTextFile(`${target}/hyacine.yml`)).slice(0, 200);
      pushLog("hyacine.yml 已就位 ✓");
      pushLog(configPreview);
      patchStep(1, { status: "success" });
      patchStep(2, { status: "process" });
      toast.success("仓库克隆成功");
    } catch (e: unknown) {
      patchStep(1, { status: "error", error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const runInstall = async (): Promise<void> => {
    const target = projectDir();
    if (target === null) return;
    setBusy(true);
    patchStep(2, { status: "process", error: "" });
    try {
      if (deps().pnpm === null) {
        pushLog("未检测到 pnpm，跳过安装（可稍后手动执行 pnpm install）。");
        patchStep(2, { status: "success", error: "" });
      } else {
        pushLog("执行 pnpm install …");
        const r = await runShell("pnpm", ["install"], target);
        pushLog(r.stdout || r.stderr);
        if (r.code !== 0) {
          patchStep(2, { status: "error", error: r.stderr || r.stdout || "pnpm install 失败" });
          return;
        }
        patchStep(2, { status: "success" });
      }
      patchStep(3, { status: "process" });
      toast.success("依赖安装完成");
    } catch (e: unknown) {
      patchStep(2, { status: "error", error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const skipInstall = (): void => {
    patchStep(2, { status: "success", error: "" });
    patchStep(3, { status: "process" });
  };

  const finish = async (): Promise<void> => {
    const target = projectDir();
    if (target === null) return;
    try {
      await projectStore.openProject(target);
      toast.success("博客初始化成功，正在前往工作台");
      navigate("/workspace");
    } catch (e: unknown) {
      patchStep(3, { status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  };

  const stepStatus = (i: number): string => steps()[i]?.status ?? "wait";
  const stepError = (i: number): string => steps()[i]?.error ?? "";
  const stepDone = (i: number): boolean => stepStatus(i) === "success";
  const stepFailed = (i: number): boolean => stepStatus(i) === "error";

  return (
    <div class="flex flex-col gap-6 max-w-3xl mx-auto">
      <PageHeader
        title="初始化安装 Astro Blog（Setup 向导）"
        description="一键克隆并配置基于 ShokaX 主题的 Astro 博客工程"
        actions={
          <Button
            variant="outline"
            size="sm"
            icon="i-ri-arrow-left-line"
            onClick={() => navigate("/login")}
          >
            返回登录
          </Button>
        }
      />

      <Show when={!isTauri()}>
        <Alert variant="info">{t("workspace.requireTauri")}</Alert>
      </Show>

      {/* Step Wizard Bar */}
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <For each={steps()}>
          {(s, i) => (
            <div
              class={`p-3 rounded-[6px] border flex flex-col gap-1 transition-all ${
                stepDone(i())
                  ? "border-[var(--ok)] bg-[var(--note-success-bg)] text-[var(--note-success-text)]"
                  : stepFailed(i())
                    ? "border-[var(--danger)] bg-[var(--note-danger-bg)] text-[var(--note-danger-text)]"
                    : stepStatus(i()) === "process"
                      ? "border-[var(--accent)] bg-[var(--surface)] text-[var(--accent)] shadow-xs"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] opacity-60"
              }`}
            >
              <div class="flex items-center gap-1.5 font-semibold text-xs">
                <span class="w-4 h-4 rounded-full bg-current/15 flex items-center justify-center text-[10px]">
                  {i() + 1}
                </span>
                <span>{s.title}</span>
              </div>
              <span class="text-[11px] truncate">{s.description}</span>
            </div>
          )}
        </For>
      </div>

      {/* Step 1: Dependencies */}
      <Card class="flex flex-col gap-3">
        <CardHeader>
          <div>
            <CardTitle>1) 系统依赖检查</CardTitle>
            <CardDescription>检查 Git 与包管理器运行环境</CardDescription>
          </div>
        </CardHeader>

        <Show when={stepFailed(0)}>
          <Alert variant="error">{stepError(0)}</Alert>
        </Show>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div class="p-2.5 rounded-[4px] bg-[var(--g-1)] border border-[var(--border)] flex items-center justify-between">
            <span class="text-[var(--muted)]">Git：</span>
            <span class="font-mono font-medium">{deps().git === null ? "未检测到 / 缺失" : deps().git}</span>
          </div>
          <div class="p-2.5 rounded-[4px] bg-[var(--g-1)] border border-[var(--border)] flex items-center justify-between">
            <span class="text-[var(--muted)]">pnpm：</span>
            <span class="font-mono font-medium">{deps().pnpm === null ? "未检测到 (可跳过)" : deps().pnpm}</span>
          </div>
        </div>

        <div class="pt-1">
          <Button
            variant="outline"
            size="sm"
            disabled={busy()}
            icon="i-ri-refresh-line"
            onClick={() => void checkDeps()}
          >
            重新检查环境
          </Button>
        </div>
      </Card>

      {/* Step 2: Clone */}
      <Card class="flex flex-col gap-4">
        <CardHeader>
          <div>
            <CardTitle>2) 克隆仓库模板</CardTitle>
            <CardDescription>配置 GitHub 仓库源与本地落盘目录</CardDescription>
          </div>
        </CardHeader>

        <Show when={stepError(1).length > 0}>
          <Alert variant="error">{stepError(1)}</Alert>
        </Show>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="仓库地址"
            value={repo()}
            onInput={(e) => setRepo(e.currentTarget.value)}
          />

          <Select
            label="克隆加速源"
            value={source()}
            onChange={(e) => setSource(e.currentTarget.value as CloneSource)}
            options={CLONE_SOURCES.map((s) => ({ label: `${s.label} — ${s.description}`, value: s.key }))}
          />
        </div>

        <div class="flex flex-col gap-1 text-sm">
          <label class="font-medium text-xs text-[var(--text)]">目标安装目录</label>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon="i-ri-folder-open-line"
              onClick={() => void chooseDir()}
            >
              选择目标目录
            </Button>
            <span class="text-xs font-mono text-[var(--muted)] truncate max-w-sm">
              {targetDir() ?? "尚未选择目录"}
            </span>
          </div>
        </div>

        <div class="pt-1">
          <Button
            variant="primary"
            size="md"
            loading={busy() && stepStatus(1) === "process"}
            disabled={busy() || targetDir() === null || stepFailed(0)}
            icon="i-ri-download-cloud-line"
            onClick={() => void runClone()}
          >
            执行 Git Clone 克隆
          </Button>
        </div>
      </Card>

      {/* Step 3: Install */}
      <Show when={stepStatus(1) === "success" || stepStatus(2) !== "wait"}>
        <Card class="flex flex-col gap-4">
          <CardHeader>
            <div>
              <CardTitle>3) 安装项目依赖 (pnpm install)</CardTitle>
              <CardDescription>拉取 Astro 及 ShokaX 相关 node_modules 依赖库</CardDescription>
            </div>
          </CardHeader>

          <Show when={stepError(2).length > 0}>
            <Alert variant="error">{stepError(2)}</Alert>
          </Show>

          <div class="flex items-center gap-2">
            <Button
              variant="primary"
              size="md"
              loading={busy() && stepStatus(2) === "process"}
              disabled={busy() || deps().pnpm === null}
              icon="i-ri-play-fill"
              onClick={() => void runInstall()}
            >
              开始执行 pnpm install
            </Button>
            <Button
              variant="outline"
              size="md"
              disabled={busy()}
              onClick={skipInstall}
            >
              跳过依赖安装
            </Button>
          </div>
        </Card>
      </Show>

      {/* Step 4: Finish */}
      <Show when={stepStatus(2) === "success"}>
        <Card class="flex flex-col gap-4 bg-[var(--note-success-bg)] border-[var(--note-success-border)]">
          <CardHeader>
            <div>
              <CardTitle>4) 初始化就绪！</CardTitle>
              <CardDescription>博客工程已准备完毕，可以立即打开工作台开始使用</CardDescription>
            </div>
          </CardHeader>

          <div class="text-xs">
            <span class="text-[var(--muted)]">项目目录：</span>
            <span class="font-mono font-semibold">{projectDir()}</span>
          </div>

          <div>
            <Button
              variant="success"
              size="md"
              icon="i-ri-folder-open-line"
              onClick={() => void finish()}
            >
              在 Workspace 工作台中打开
            </Button>
          </div>
        </Card>
      </Show>

      {/* Execution Logs */}
      <Show when={logs().length > 0}>
        <Card class="flex flex-col gap-2 p-4">
          <span class="text-xs font-semibold text-[var(--muted)]">执行输出日志</span>
          <pre class="text-xs font-mono whitespace-pre-wrap bg-[var(--g-1)] border border-[var(--border)] rounded-[4px] p-3 max-h-52 overflow-auto leading-relaxed text-[var(--text)]">
            {logs().join("\n")}
          </pre>
        </Card>
      </Show>
    </div>
  );
}
