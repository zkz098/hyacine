import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

export function findBuildCommand(projectRoot: string): string[] | null {
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON parse returns any
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { scripts?: Record<string, string> };
    const scripts = pkg.scripts ?? {};
    if (scripts.build !== undefined) return ["pnpm", "run", "build"];
    if (scripts["build:site"] !== undefined) return ["pnpm", "run", "build:site"];
    // Fallback to npx astro
    return ["npx", "astro", "build"];
  } catch {
    return null;
  }
}

export function runCommand(cmd: string[], cwd: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd[0] ?? "", cmd.slice(1), { cwd, stdio: "inherit", shell: true });
    proc.on("close", (code) => resolve(code ?? 0));
    proc.on("error", (err) => reject(err));
  });
}
