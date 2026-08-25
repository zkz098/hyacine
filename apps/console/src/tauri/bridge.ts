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

export async function writeTextFile(path: string, content: string): Promise<void> {
  if (!isTauri()) requireTauri();
  const { writeTextFile: wtf } = await import("@tauri-apps/plugin-fs");
  return wtf(path, content);
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

export async function gitExec(args: string[], cwd: string): Promise<GitResult> {
  if (!isTauri()) requireTauri();
  const { Command } = await import("@tauri-apps/plugin-shell");
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- shell cwd typed as unknown in plugin
  const cmd = Command.create("git", args, { cwd } as unknown as Record<string, unknown>);
  const out = await cmd.execute();
  return { stdout: out.stdout, stderr: out.stderr, code: out.code ?? 0 };
}

export async function gitVersion(): Promise<string | null> {
  try {
    const r = await gitExec(["--version"], "");
    if (r.code === 0) return r.stdout.trim();
    return null;
  } catch {
    return null;
  }
}
