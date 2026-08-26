import { createSignal, onMount, Show, For } from "solid-js";
import { t } from "../i18n";
import { isTauri, gitExec } from "../tauri/bridge";
import { projectStore } from "../store/project";
import { Alert } from "../components/Alert";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Card, CardHeader, CardTitle, CardDescription } from "../components/Card";
import { Badge } from "../components/Badge";
import { PageHeader } from "../components/PageHeader";
import { EmptyState } from "../components/EmptyState";
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

function statusBadgeVariant(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "新增") return "success";
  if (status === "修改") return "warning";
  if (status === "删除") return "danger";
  if (status === "重命名") return "info";
  return "neutral";
}

export function Git(): import("solid-js").JSX.Element {
  const [statusLines, setStatusLines] = createSignal<Array<{ status: string; path: string }>>([]);
  const [branch, setBranch] = createSignal<string>("");
  const [commitMsg, setCommitMsg] = createSignal(
    `chore: update blog ${new Date().toISOString().slice(0, 10)}`,
  );
  const [output, setOutput] = createSignal<string>("");
  const [error, setError] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [pushing, setPushing] = createSignal(false);

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
      if (commit.code !== 0) {
        setError(commit.stderr || commit.stdout);
        toast.error("Git commit 执行失败");
      } else {
        toast.success("Git 提交成功");
        await refresh();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async (): Promise<void> => {
    const dir = cwd();
    if (dir === null) return;
    setPushing(true);
    setError(null);
    setOutput("");
    try {
      const r = await gitExec(["push"], dir);
      setOutput(r.stdout + r.stderr);
      if (r.code !== 0) {
        setError(r.stderr || r.stdout);
        toast.error("Git push 失败，请检查远端网络与权限");
      } else {
        toast.success("已成功推送到远程仓库");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPushing(false);
    }
  };

  return (
    <div class="flex flex-col gap-6">
      <PageHeader
        title={t("git.title")}
        description="管理本地博客 Git 工作区状态、暂存变更、提交与推送"
        badge={
          <Show when={branch()}>
            <Badge variant="primary" dot icon="i-ri-git-branch-line">
              {branch()}
            </Badge>
          </Show>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            icon="i-ri-refresh-line"
            onClick={() => void refresh()}
          >
            {t("common.refresh")}
          </Button>
        }
      />

      <Show when={!isTauri()}>
        <Alert variant="info">{t("workspace.requireTauri")}</Alert>
      </Show>

      <Show when={cwd() === null}>
        <EmptyState
          icon="i-ri-folder-open-line"
          title={t("workspace.empty")}
          description="请先在「工作台」中打开一个博客项目以使用 Git 版本控制功能"
        />
      </Show>

      <Show when={cwd() !== null}>
        <div class="flex flex-col gap-5">
          {/* Workspace Path Card */}
          <Card class="bg-gradient-to-r from-[var(--surface)] to-[var(--g-1)]">
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-2">
                <span class="i-ri-git-repository-line text-lg text-[var(--accent)]" />
                <span class="font-semibold text-[var(--text)]">当前仓库目录：</span>
                <span class="font-mono text-[var(--muted)]">{cwd()}</span>
              </div>
              <Badge variant="neutral">
                {statusLines().length === 0 ? "工作区干净" : `${statusLines().length} 项待提交变更`}
              </Badge>
            </div>
          </Card>

          <Show when={error() !== null}>
            <Alert variant="error" title="Git 操作错误">
              {error()}
            </Alert>
          </Show>

          {/* Changed Files */}
          <div class="flex flex-col gap-3">
            <h3 class="text-sm font-semibold text-[var(--text)]">文件变更列表</h3>

            <Show
              when={statusLines().length > 0}
              fallback={
                <Card class="p-6 text-center text-xs text-[var(--muted)] flex items-center justify-center gap-2">
                  <span class="i-ri-checkbox-circle-line text-base text-[var(--ok)]" />
                  <span>工作区干净，暂无未提交的更改</span>
                </Card>
              }
            >
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow hoverable={false}>
                      <TableHeader class="w-[20%]">变更类型</TableHeader>
                      <TableHeader class="w-[80%]">文件路径</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <For each={statusLines()}>
                      {(e) => (
                        <TableRow>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(e.status)} size="sm">
                              {e.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span class="font-mono text-xs text-[var(--text)]">{e.path}</span>
                          </TableCell>
                        </TableRow>
                      )}
                    </For>
                  </TableBody>
                </Table>
              </TableContainer>
            </Show>
          </div>

          {/* Commit & Push Form */}
          <Card class="flex flex-col gap-4">
            <CardHeader>
              <div>
                <CardTitle>提交并推送至远端</CardTitle>
                <CardDescription>自动执行 git add -A 并创建本地 Commit</CardDescription>
              </div>
            </CardHeader>

            <Input
              label="提交信息 (Commit Message)"
              value={commitMsg()}
              onInput={(e) => setCommitMsg(e.currentTarget.value)}
              placeholder="chore: update blog..."
              icon="i-ri-message-3-line"
            />

            <div class="flex items-center gap-2.5 pt-1">
              <Button
                variant="primary"
                size="sm"
                loading={loading()}
                disabled={statusLines().length === 0}
                icon="i-ri-git-commit-line"
                onClick={() => void handleCommit()}
              >
                {t("git.commit")}
              </Button>

              <Button
                variant="outline"
                size="sm"
                loading={pushing()}
                icon="i-ri-upload-2-line"
                onClick={() => void handlePush()}
              >
                {t("git.push")}
              </Button>
            </div>

            <Show when={output().length > 0}>
              <div class="mt-2 flex flex-col gap-1">
                <span class="text-[11px] font-semibold text-[var(--muted)]">终端输出</span>
                <pre class="text-xs bg-[var(--g-1)] border border-[var(--border)] rounded-[4px] p-3 overflow-auto max-h-48 whitespace-pre-wrap font-mono leading-relaxed text-[var(--text)]">
                  {output()}
                </pre>
              </div>
            </Show>
          </Card>
        </div>
      </Show>
    </div>
  );
}
