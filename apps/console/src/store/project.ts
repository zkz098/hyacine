import { createSignal } from "solid-js";
import { parse as yamlParse } from "yaml";
import { isTauri, readDirRecursive, readTextFile } from "../tauri/bridge";
import { parseFrontmatter } from "../lib/frontmatter";
import { postBodyHash } from "../lib/postHash";

export interface ProjectConfig {
  contentDir: string;
  assetsDir: string;
}

export interface LocalPostInfo {
  path: string; // 相对 contentDir 的路径，如 "hello.md"
  fullPath: string; // 绝对路径
  title: string;
  slug: string;
  draft: boolean;
  categories: string[];
  hash: string;
  summaryPresent: boolean;
  updatedAt: string;
}

const [projectDir, setProjectDir] = createSignal<string | null>(null);
const [projectConfig, setProjectConfig] = createSignal<ProjectConfig | null>(null);
const [posts, setPosts] = createSignal<LocalPostInfo[]>([]);
const [loading, setLoading] = createSignal(false);
const [error, setError] = createSignal<string | null>(null);

function defaultConfig(): ProjectConfig {
  return { contentDir: "src/posts", assetsDir: "src/assets" };
}

async function loadConfig(dir: string): Promise<ProjectConfig> {
  const candidates = [`${dir}/hyacine.yml`, `${dir}/hyacine.yaml`];
  for (const p of candidates) {
    try {
      const raw = await readTextFile(p);
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- yaml parse returns any
      const parsed = yamlParse(raw) as Record<string, unknown>;
      const contentDir =
        typeof parsed.contentDir === "string" ? parsed.contentDir : defaultConfig().contentDir;
      const assetsDir =
        typeof parsed.assetsDir === "string" ? parsed.assetsDir : defaultConfig().assetsDir;
      return { contentDir, assetsDir };
    } catch {
      // try next
    }
  }
  return defaultConfig();
}

function extractTitle(data: Record<string, unknown>, fallback: string): string {
  const t = data.title;
  if (typeof t === "string" && t.length > 0) return t;
  return fallback;
}

function extractSlug(data: Record<string, unknown>, title: string): string {
  const s = data.slug;
  if (typeof s === "string" && s.length > 0) return s.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return title.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "untitled";
}

export async function openProject(dir: string): Promise<void> {
  if (!isTauri()) throw new Error("require_tauri");
  setProjectDir(dir);
  setError(null);
  const cfg = await loadConfig(dir);
  setProjectConfig(cfg);
  await refreshPosts();
}

export async function refreshPosts(): Promise<void> {
  const dir = projectDir();
  const cfg = projectConfig();
  if (dir === null || cfg === null) return;
  setLoading(true);
  setError(null);
  try {
    const contentAbs = `${dir}/${cfg.contentDir}`;
    const files = await readDirRecursive(contentAbs);
    const mdFiles = files.filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));
    const infos: LocalPostInfo[] = [];
    const fileErrors: string[] = [];
    for (const full of mdFiles) {
      try {
        const raw = await readTextFile(full);
        const parsed = parseFrontmatter(raw);
        const data = parsed.data;
        const rel = full.startsWith(`${contentAbs}/`) ? full.slice(contentAbs.length + 1) : full;
        const title = extractTitle(data, rel.replace(/\.(md|mdx)$/, ""));
        const slug = extractSlug(data, title);
        const draft = data.draft === true;
        const categories = Array.isArray(data.categories)
          ? (data.categories as unknown[]).filter((x): x is string => typeof x === "string")
          : typeof data.categories === "string" && data.categories.length > 0
            ? [data.categories]
            : [];
        const hash = postBodyHash(raw);
        const summaryPresent = typeof data.summary === "string" && data.summary.length > 0;
        infos.push({
          path: rel,
          fullPath: full,
          title,
          slug,
          draft,
          categories,
          hash,
          summaryPresent,
          updatedAt: "",
        });
      } catch (e: unknown) {
        // 收集真实失败原因，避免“静默空列表”掩盖问题
        const reason = e instanceof Error ? e.message : String(e);
        if (fileErrors.length < 3) fileErrors.push(`${full}: ${reason}`);
      }
    }
    // 按 path 排序
    infos.sort((a, b) => a.path.localeCompare(b.path));
    setPosts(infos);
    if (infos.length > 0) {
      setError(null);
    } else if (mdFiles.length === 0) {
      setError(`在 ${contentAbs} 下未发现任何 .md/.mdx 文件（readDir 返回 ${files.length} 项）`);
    } else if (fileErrors.length > 0) {
      setError(`扫描到 ${mdFiles.length} 个文件但读取全部失败，前几个错误：${fileErrors.join(" | ")}`);
    }
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : String(err));
  } finally {
    setLoading(false);
  }
}

export function getProjectDir(): string | null {
  return projectDir();
}

export function useProject() {
  return {
    projectDir,
    projectConfig,
    posts,
    loading,
    error,
    openProject,
    refreshPosts,
    setProjectDir,
  };
}

export const projectStore = {
  projectDir,
  projectConfig,
  posts,
  loading,
  error,
  openProject,
  refreshPosts,
  getProjectDir,
};
