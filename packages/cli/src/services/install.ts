import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const exec = promisify(execFile);

export const DEFAULT_BLOG_REPO = "https://github.com/theme-shoka-x/astro-blog-shokax";

export type CloneSource = "github" | "gh-proxy" | "gh-proxy-v6";

export function resolveCloneUrl(repository: string, source: CloneSource): string {
  const repo = repository.trim().replace(/\/+$/, "");
  if (repo.length === 0) return "";
  if (source === "github") return repo;
  return source === "gh-proxy"
    ? `https://gh-proxy.org/${repo}`
    : `https://v6.gh-proxy.org/${repo}`;
}

async function versionOf(program: string): Promise<string | null> {
  try {
    const { stdout, stderr } = await exec(program, ["--version"], { timeout: 8000 });
    return (stdout || stderr).trim() || null;
  } catch {
    return null;
  }
}

function isEmptyDir(dir: string): boolean {
  try {
    return readdirSync(dir).length === 0;
  } catch {
    return false;
  }
}

async function run(program: string, args: string[], cwd: string): Promise<void> {
  const { stdout, stderr } = await exec(program, args, { cwd, timeout: 60 * 60 * 1000 });
  const out = (stdout + stderr).trim();
  if (out.length > 0) console.log(out);
}

export interface InstallBlogOptions {
  dir: string;
  source: CloneSource;
  repository?: string;
  install?: boolean;
  packageManager?: "pnpm" | "npm" | "bun";
}

export interface InstallBlogResult {
  root: string;
  clonedInto: string;
  installed: boolean;
  packageManager: string | null;
}

/**
 * 安装 Blog（旧 hyc setup 模式移植）：
 * 依赖检查(git) → 克隆 astro-blog-shokax 模板 → 校验 hyacine.yml →
 * 可选依赖安装。
 */
export async function installBlog(options: InstallBlogOptions): Promise<InstallBlogResult> {
  const dir = resolve(options.dir);
  const url = resolveCloneUrl(options.repository ?? DEFAULT_BLOG_REPO, options.source);
  if (url.length === 0) throw new Error("仓库地址为空");

  // 1) 依赖检查
  const git = await versionOf("git");
  if (git === null) {
    throw new Error("未检测到 git，请先安装 Git 并加入 PATH。");
  }
  console.log(`✔ git ${git}`);

  // 2) 确定克隆目标：目录为空 → 直接克隆到该目录；否则目录/astro-blog-shokax[-n]
  let target = dir;
  if (existsSync(dir) && !isEmptyDir(dir)) {
    target = join(dir, "astro-blog-shokax");
    let n = 1;
    while (existsSync(target)) {
      target = join(dir, `astro-blog-shokax-${n}`);
      n += 1;
    }
  }
  console.log(`克隆到: ${target}`);
  await run("git", ["clone", "--depth", "1", url, target], dir);

  // 3) 校验 hyacine.yml（模板自带）
  if (!existsSync(join(target, "hyacine.yml"))) {
    throw new Error(`克隆完成但缺少 hyacine.yml（${target}），请确认模板仓库。`);
  }
  console.log("✔ hyacine.yml 已就位");

  // 4) 可选依赖安装
  const pm = options.packageManager ?? "pnpm";
  let installed = false;
  if (options.install === true) {
    const pmVersion = await versionOf(pm);
    if (pmVersion === null) {
      console.warn(`跳过安装：未检测到 ${pm}。可稍后在项目目录手动执行 ${pm} install。`);
    } else {
      console.log(`✔ ${pm} ${pmVersion}，执行 ${pm} install …`);
      await run(pm, ["install"], target);
      installed = true;
    }
  }

  return { root: target, clonedInto: target, installed, packageManager: pm };
}