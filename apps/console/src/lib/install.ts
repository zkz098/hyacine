/** 安装 Blog（setup 模式移植）：模板仓库与克隆源解析。 */

export const DEFAULT_BLOG_REPO = "https://github.com/theme-shoka-x/astro-blog-shokax";
/** GitHub 可达性检测目标（旧 hyc 同款） */
export const GITHUB_ACCESS_CHECK_TARGET = "https://raw.githubusercontent.com/";

export type CloneSource = "github" | "gh-proxy" | "gh-proxy-v6";

export const CLONE_SOURCES: ReadonlyArray<{
  key: CloneSource;
  label: string;
  description: string;
}> = [
  { key: "github", label: "Github", description: "直接使用 Github 官方源" },
  { key: "gh-proxy", label: "gh-proxy.com", description: "https://gh-proxy.org/{github链接}" },
  {
    key: "gh-proxy-v6",
    label: "gh-proxy.com（IPv6）",
    description: "https://v6.gh-proxy.org/{github链接}",
  },
];

/** 解析最终克隆地址（github 原样；gh-proxy 代理需要完整 URL 跟在域名后） */
export function resolveCloneUrl(repository: string, source: CloneSource): string {
  const repo = repository.trim().replace(/\/+$/, "");
  if (repo.length === 0) return "";
  if (source === "github") return repo;
  return source === "gh-proxy" ? `https://gh-proxy.org/${repo}` : `https://v6.gh-proxy.org/${repo}`;
}

/** 目录选择结果：直接克隆到该目录（空）或克隆到其下的唯一子目录 */
export async function resolveCloneTarget(
  dir: string,
  baseName: string,
  occupied: (p: string) => Promise<boolean>,
): Promise<string> {
  if (!(await occupied(dir))) return dir;
  let candidate = `${dir}/${baseName}`;
  let n = 1;
  while (await occupied(candidate)) {
    candidate = `${dir}/${baseName}-${n}`;
    n += 1;
  }
  return candidate;
}
