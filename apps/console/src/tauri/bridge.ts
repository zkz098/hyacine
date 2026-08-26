/** Tauri 桥接：惰性动态 import，WebUI 永远不触发 */

export function isTauri(): boolean {
  return (
    typeof window !== "undefined" &&
    // oxlint-disable-next-line eslint/no-underscore-dangle, typescript/no-unsafe-type-assertion -- tauri global is underscored by design
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== undefined
  );
}

function requireTauri(): never {
  throw new Error("require_tauri: 仅桌面模式可用");
}

export async function openFolderDialog(): Promise<string | null> {
  if (!isTauri()) requireTauri();
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({ directory: true, multiple: false });
  if (typeof selected === "string") return selected;
  return null;
}

export async function readTextFile(path: string): Promise<string> {
  if (!isTauri()) requireTauri();
  const { readTextFile: rtf } = await import("@tauri-apps/plugin-fs");
  return rtf(path);
}

export interface StatInfo {
  size: number;
  mtime: Date | null;
  birthtime: Date | null;
}

export async function statFile(path: string): Promise<StatInfo | null> {
  if (!isTauri()) requireTauri();
  const { stat } = await import("@tauri-apps/plugin-fs");
  try {
    const s = await stat(path);
    return { size: s.size, mtime: s.mtime ?? null, birthtime: s.birthtime ?? null };
  } catch {
    return null;
  }
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  if (!isTauri()) requireTauri();
  const { writeTextFile: wtf } = await import("@tauri-apps/plugin-fs");
  return wtf(path, content);
}

export async function removeFile(path: string): Promise<void> {
  if (!isTauri()) requireTauri();
  const { remove } = await import("@tauri-apps/plugin-fs");
  return remove(path);
}

export async function readDirRecursive(dir: string): Promise<string[]> {
  if (!isTauri()) requireTauri();
  const { readDir } = await import("@tauri-apps/plugin-fs");
  const out: string[] = [];
  async function walk(current: string): Promise<void> {
    let entries: Awaited<ReturnType<typeof readDir>>;
    try {
      entries = await readDir(current);
    } catch {
      // 某个子目录不可读（权限/联结点死循环/损坏）时跳过它，不要让整棵树失败
      return;
    }
    for (const e of entries) {
      const full = `${current}/${e.name}`;
      if (e.isDirectory) {
        await walk(full);
      } else if (e.isFile) {
        out.push(full);
      }
    }
  }
  await walk(dir);
  return out;
}

export async function exists(path: string): Promise<boolean> {
  if (!isTauri()) requireTauri();
  const { exists: ex } = await import("@tauri-apps/plugin-fs");
  return ex(path);
}

export async function isEmptyDir(path: string): Promise<boolean> {
  if (!isTauri()) requireTauri();
  const { readDir } = await import("@tauri-apps/plugin-fs");
  try {
    return (await readDir(path)).length === 0;
  } catch {
    return false;
  }
}

export async function mkdir(path: string): Promise<void> {
  if (!isTauri()) requireTauri();
  const { mkdir: mk } = await import("@tauri-apps/plugin-fs");
  return mk(path, { recursive: true });
}

export interface GitResult {
  stdout: string;
  stderr: string;
  code: number;
}

export async function gitExec(args: string[], cwd?: string): Promise<GitResult> {
  if (!isTauri()) requireTauri();
  const { Command } = await import("@tauri-apps/plugin-shell");
  const options =
    cwd !== undefined && cwd.trim().length > 0
      ? ({ cwd: cwd.trim() } as unknown as Record<string, unknown>)
      : undefined;
  const cmd = Command.create("git", args, options);
  const out = await cmd.execute();
  return { stdout: out.stdout, stderr: out.stderr, code: out.code ?? 0 };
}

/**
 * 通用 shell 执行：仅允许白名单程序（与 capabilities 的 shell:allow-execute 一致）。
 * 用于 setup/安装 Blog（git clone / pnpm install）等。
 */
const SHELL_ALLOWLIST = new Set(["git", "pnpm", "npm", "bun"]);

export async function runShell(program: string, args: string[], cwd?: string): Promise<GitResult> {
  if (!isTauri()) requireTauri();
  if (!SHELL_ALLOWLIST.has(program)) {
    return { stdout: "", stderr: `${program} 不在允许列表`, code: 1 };
  }
  const { Command } = await import("@tauri-apps/plugin-shell");
  const options =
    cwd !== undefined && cwd.trim().length > 0
      ? ({ cwd: cwd.trim() } as unknown as Record<string, unknown>)
      : undefined;
  const cmd = Command.create(program, args, options);
  const out = await cmd.execute();
  return { stdout: out.stdout, stderr: out.stderr, code: out.code ?? 0 };
}

export async function shellVersion(program: string): Promise<string | null> {
  try {
    const r = await runShell(program, ["--version"]);
    if (r.code === 0) return (r.stdout || r.stderr).trim();
    return null;
  } catch {
    return null;
  }
}

export async function gitVersion(): Promise<string | null> {
  try {
    const r = await gitExec(["--version"]);
    if (r.code === 0) return (r.stdout || r.stderr).trim();
    return null;
  } catch {
    return null;
  }
}
