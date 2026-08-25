// oxlint-disable typescript/no-unnecessary-type-arguments -- createSignal generics needed for empty/null initial values
import { createSignal, onMount, Show } from "solid-js";
import { t } from "../i18n";
import { isTauri, gitExec } from "../tauri/bridge";
import { projectStore } from "../store/project";
import { Alert } from "../components/Alert";

function parsePorcelain(output: string): Array<{ status: string; path: string }> {
  return output
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((line) => {
      const xy = line.slice(0, 2);
      const staged = xy[0] ?? " ";
      const unstaged = xy[1] ?? " ";
      let path = line.slice(3).trim();
      // 重命名条目形如 "R  old -> new"，取目标路径
      if ((staged === "R" || unstaged === "R") && path.includes(" -> ")) {
        path = path.split(" -> ").pop()?.trim() ?? path;
      }
      let status: string;
      if (xy === "??") status = "新增";
      else if (staged === "D" || unstaged === "D") status = "删除";
      else if (staged === "A") status = "新增";
      else if (staged === "R" || unstaged === "R") status = "重命名";
      else if (staged === "M" || unstaged === "M") status = "修改";
      else status = xy.trim() || "变更";
      return { status, path };
    });
}

export function Git(): import("solid-js").JSX.Element {
  // oxlint-disable-next-line typescript/no-unnecessary-type-arguments -- empty array needs explicit type
  const [statusLines, setStatusLines] = createSignal<Array<{ status: string; path: string }>>([]);
  // oxlint-disable-next-line typescript/no-unnecessary-type-arguments -- keep explicit
  const [branch, setBranch] = createSignal<string>("");
  const [commitMsg, setCommitMsg] = createSignal(
    `chore: update blog ${new Date().toISOString().slice(0, 10)}`,
  );
  const [output, setOutput] = createSignal<string>("");
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  // oxlint-disable-next-line unicorn/consistent-function-scoping -- captures projectStore
  const cwd = (): string | null => projectStore.projectDir();

  const refresh = async (): Promise<void> => {
    const dir = cwd();
    if (dir === null) return;
    setError(null);
    try {
      const [st, br] = await Promise.all([
        gitExec(["status", "--porcelain"], dir),
        gitExec(["rev-parse", "--abbrev-ref", "HEAD"], dir),
      ]);
      if (st.code === 0) setStatusLines(parsePorcelain(st.stdout));
      else setError(st.stderr || st.stdout);
      if (br.code === 0) setBranch(br.stdout.trim());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  onMount(() => {
    void refresh();
  });

  const handleCommit = async (): Promise<void> => {
    const dir = cwd();
    if (dir === null) return;
    const msg = commitMsg().trim();
    if (msg.length === 0) {
      setError("请输入提交信息");
      return;
    }
    setLoading(true);
    setError(null);
    setOutput("");
    try {
      const add = await gitExec(["add", "-A"], dir);
      if (add.code !== 0) {
        setError(add.stderr || add.stdout);
        return;
      }
      const commit = await gitExec(["commit", "-m", msg], dir);
      setOutput(commit.stdout + commit.stderr);
      if (commit.code !== 0) setError(commit.stderr || commit.stdout);
      else await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async (): Promise<void> => {
    const dir = cwd();
    if (dir === null) return;
    setLoading(true);
    setError(null);
    setOutput("");
    try {
      const r = await gitExec(["push"], dir);
      setOutput(r.stdout + r.stderr);
      if (r.code !== 0) setError(r.stderr || r.stdout);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="flex flex-col gap-4">
      <Show when={!isTauri()}>
        <Alert variant="info">{t("workspace.requireTauri")}</Alert>
      </Show>

      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">{t("git.title")}</h1>
        <button
          type="button"
          onClick={() => void refresh()}
          class="px-3 py-1.5 rounded border border-[var(--border)] text-sm hover:bg-[var(--surface)]"
        >
          <span class="i-ri-refresh-line mr-1" />
          {t("common.refresh")}
        </button>
      </div>

      <Show when={cwd() === null}>
        <Alert variant="info">{t("workspace.empty")}</Alert>
      </Show>

      <Show when={cwd() !== null}>
        <div class="surface p-4 flex flex-col gap-3">
          <div class="text-sm">
            <span class="text-muted">分支：</span>
            <span class="font-mono text-xs bg-[var(--bg)] border border-[var(--border)] px-2 py-1 rounded">
              {branch() || "—"}
            </span>
            <span class="ml-2 text-muted">目录：</span>
            <span class="font-mono text-xs">{cwd()}</span>
          </div>

          <Show when={error() !== null}>
            <Alert variant="error">{error()}</Alert>
          </Show>

          <Show when={statusLines().length === 0}>
            <p class="text-sm text-muted">工作区干净</p>
          </Show>

          <Show when={statusLines().length > 0}>
            <div class="border border-[var(--border)] rounded overflow-auto max-h-64">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-[var(--border)] text-left text-xs text-muted">
                    <th class="px-3 py-1">状态</th>
                    <th class="px-3 py-1">文件</th>
                  </tr>
                </thead>
                <tbody>
                  {statusLines().map((e) => (
                    <tr class="border-b border-[var(--border)] last:border-0">
                      <td class="px-3 py-1 text-xs">{e.status}</td>
                      <td class="px-3 py-1 font-mono text-xs">{e.path}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Show>

          <label class="flex flex-col gap-1 text-sm">
            <span>提交信息</span>
            <input
              value={commitMsg()}
              onInput={(e) => setCommitMsg(e.currentTarget.value)}
              class="px-3 py-2 rounded border border-[var(--border)] bg-[var(--bg)] text-sm"
            />
          </label>

          <div class="flex gap-2">
            <button
              type="button"
              onClick={() => void handleCommit()}
              disabled={loading()}
              class="px-4 py-2 rounded bg-[var(--accent)] text-white text-sm hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {t("git.commit")}
            </button>
            <button
              type="button"
              onClick={() => void handlePush()}
              disabled={loading()}
              class="px-4 py-2 rounded border border-[var(--border)] text-sm hover:bg-[var(--surface)] disabled:opacity-50"
            >
              {t("git.push")}
            </button>
          </div>

          <Show when={output().length > 0}>
            <pre class="text-xs bg-[var(--bg)] border border-[var(--border)] rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">
              {output()}
            </pre>
          </Show>
        </div>
      </Show>
    </div>
  );
}
