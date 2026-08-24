import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

function runGit(
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("git", args, { cwd });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
    proc.on("error", (err: Error) => resolve({ code: 1, stdout: "", stderr: err.message }));
  });
}

export async function isGitRepo(projectRoot: string): Promise<boolean> {
  const res = await runGit(["rev-parse", "--is-inside-work-tree"], projectRoot);
  return res.code === 0 && res.stdout.trim() === "true";
}

export async function gitAddAll(projectRoot: string): Promise<void> {
  await runGit(["add", "-A"], projectRoot);
}

export async function gitCommit(projectRoot: string, message: string): Promise<number> {
  const res = await runGit(["commit", "-m", message], projectRoot);
  return res.code;
}

export async function gitPush(projectRoot: string): Promise<number> {
  const res = await runGit(["push"], projectRoot);
  return res.code;
}

export function gitRepoExists(projectRoot: string): boolean {
  return existsSync(join(projectRoot, ".git"));
}
