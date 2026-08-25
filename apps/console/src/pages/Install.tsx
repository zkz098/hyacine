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

type StepStatus = "wait" | "process" | "success" | "error";

interface Step {
  title: string;
  description: string;
  status: StepStatus;
  error: string;
}

const initialSteps = (): Step[] => [
  { title: "检查系统依赖", description: "检查 Git、pnpm 等必须依赖", status: "process", error: "" },
  { title: "克隆仓库", description: "拉取 Astro Blog 源码到目标目录", status: "wait", error: "" },
  { title: "安装依赖", description: "自动执行 pnpm install（可跳过）", status: "wait", error: "" },
  { title: "完成并打开", description: "在 Workspace 中打开新博客", status: "wait", error: "" },
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
      patchStep(0, { status: "error", error: "未检测到 Git，请先安装并加入 PATH。" });
      return;
    }
    patchStep(0, { status: "success" });
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
      // 模板自带 hyacine.yml（astro-blog-shokax 根目录）
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
      navigate("/workspace");
    } catch (e: unknown) {
      patchStep(3, { status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  };

  const stepStatus = (i: number): string => steps()[i]?.status ?? "wait";
  const stepError = (i: number): string => steps()[i]?.error ?? "";
  const stepActive = (i: number): boolean => stepStatus(i) === "process";
  const stepDone = (i: number): boolean => stepStatus(i) === "success";
  const stepFailed = (i: number): boolean => stepStatus(i) === "error";

  return (
    <div class="flex flex-col gap-4 max-w-2xl">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">安装 Blog（Setup 模式）</h1>
        <button
          type="button"
          onClick={() => navigate("/login")}
          class="px-3 py-1.5 rounded border border-[var(--border)] text-sm hover:bg-[var(--surface)]"
        >
          返回登录
        </button>
      </div>

      <Show when={!isTauri()}>
        <Alert variant="info">{t("workspace.requireTauri")}</Alert>
      </Show>

      {/* 步骤条 */}
      <div class="flex gap-2">
        {steps().map((s, i) => (
          <div
            class={`flex-1 rounded px-2 py-1.5 text-xs border ${
              stepDone(i)
                ? "border-[var(--ok)] text-[var(--ok)] bg-[var(--surface)]"
                : stepFailed(i)
                  ? "border-[var(--danger)] text-[var(--danger)] bg-[var(--surface)]"
                  : stepActive(i)
                    ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--surface)]"
                    : "border-[var(--border)] text-[var(--muted)] bg-[var(--surface)]"
            }`}
          >
            <div class="font-semibold">
              {i + 1}. {s.title}
            </div>
            <div class="truncate">{s.description}</div>
          </div>
        ))}
      </div>

      {/* 1) 依赖检查 */}
      <div class="surface p-4 flex flex-col gap-2">
        <h2 class="font-semibold text-sm">1) 系统依赖检查</h2>
        <Show when={stepFailed(0)}>
          <Alert variant="error">{stepError(0)}</Alert>
        </Show>
        <div class="text-sm flex flex-col gap-1">
          <span class="text-muted">Git：{deps().git === null ? "检测中/缺失" : deps().git}</span>
          <span class="text-muted">
            pnpm：{deps().pnpm === null ? "未检测到（可跳过安装步骤）" : deps().pnpm}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void checkDeps()}
          disabled={busy()}
          class="self-start px-3 py-1.5 rounded border border-[var(--border)] text-sm disabled:opacity-50"
        >
          重新检查
        </button>
      </div>

      {/* 2) 克隆 */}
      <div class="surface p-4 flex flex-col gap-3">
        <h2 class="font-semibold text-sm">2) 克隆仓库</h2>
        <Show when={stepError(1)}>
          <Alert variant="error">{stepError(1)}</Alert>
        </Show>
        <label class="flex flex-col gap-1 text-sm">
          <span>GitHub 仓库地址</span>
          <input
            value={repo()}
            onInput={(e) => setRepo(e.currentTarget.value)}
            class="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span>克隆源</span>
          <select
            value={source()}
            onChange={(e) => setSource(e.currentTarget.value as CloneSource)}
            class="px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
          >
            <For each={CLONE_SOURCES}>
              {(s) => (
                <option value={s.key}>
                  {s.label} — {s.description}
                </option>
              )}
            </For>
          </select>
        </label>
        <Show when={source() !== "github"}>
          <Alert variant="warning">
            使用镜像源时请自行确认其可用性/完整性/安全性，本项目不承担责任。
          </Alert>
        </Show>
        <div class="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => void chooseDir()}
            class="px-3 py-1.5 rounded border border-[var(--border)]"
          >
            选择目标目录
          </button>
          <span class="text-muted text-xs">{targetDir() ?? "未选择"}</span>
        </div>
        <button
          type="button"
          onClick={() => void runClone()}
          disabled={busy() || targetDir() === null || stepFailed(0)}
          class="self-start px-4 py-2 rounded bg-[var(--accent)] text-white text-sm disabled:opacity-50"
        >
          执行 git clone
        </button>
      </div>

      {/* 3) 安装依赖 */}
      <Show when={stepStatus(1) === "success" || stepStatus(2) !== "wait"}>
        <div class="surface p-4 flex flex-col gap-3">
          <h2 class="font-semibold text-sm">3) 安装依赖（pnpm install）</h2>
          <Show when={stepError(2)}>
            <Alert variant="error">{stepError(2)}</Alert>
          </Show>
          <p class="text-xs text-muted">可能耗时 1-3 分钟；未装 pnpm 或不想装可直接跳过。</p>
          <div class="flex gap-2">
            <button
              type="button"
              onClick={() => void runInstall()}
              disabled={busy() || deps().pnpm === null}
              class="px-4 py-2 rounded bg-[var(--accent)] text-white text-sm disabled:opacity-50"
            >
              执行 pnpm install
            </button>
            <button
              type="button"
              onClick={skipInstall}
              disabled={busy()}
              class="px-3 py-2 rounded border border-[var(--border)] text-sm"
            >
              跳过
            </button>
          </div>
        </div>
      </Show>

      {/* 4) 完成 */}
      <Show when={stepStatus(2) === "success"}>
        <div class="surface p-4 flex flex-col gap-3">
          <h2 class="font-semibold text-sm">4) 完成并打开</h2>
          <Show when={stepError(3)}>
            <Alert variant="error">{stepError(3)}</Alert>
          </Show>
          <p class="text-sm text-muted">
            项目目录：<span class="font-mono">{projectDir()}</span>
          </p>
          <button
            type="button"
            onClick={() => void finish()}
            class="self-start px-4 py-2 rounded bg-[var(--accent)] text-white text-sm"
          >
            在 Workspace 中打开
          </button>
        </div>
      </Show>

      {/* 日志 */}
      <Show when={logs().length > 0}>
        <div class="surface p-3">
          <h3 class="text-xs font-semibold text-muted mb-1">执行日志</h3>
          <pre class="text-xs whitespace-pre-wrap bg-[var(--bg)] border border-[var(--border)] rounded p-2 max-h-56 overflow-auto">
            {logs().join("\n")}
          </pre>
        </div>
      </Show>
    </div>
  );
}
