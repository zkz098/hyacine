import { createSignal } from "solid-js";
import { parse as yamlParse } from "yaml";
import {
  DEFAULT_PROJECT_CONFIG,
  getCollections,
  parseCollectionsFile,
  parseProjectConfig,
  type ProjectConfig,
} from "@hyacine/contract";
import { displaySlug } from "@hyacine/contract";
import { isTauri, readDirRecursive, readTextFile } from "../tauri/bridge";
import { parseFrontmatter } from "../lib/frontmatter";
import { postBodyHash } from "../lib/postHash";

export interface LocalPostInfo {
  /** repo 相对路径（如 src/posts/hello.md、src/moments/foo.md） */
  path: string;
  /** 绝对路径 */
  fullPath: string;
  /** 所属集合名（getCollections 注册表；缺省 posts） */
  collection: string;
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

async function loadConfig(dir: string): Promise<ProjectConfig> {
  const candidates = [`${dir}/hyacine.yml`, `${dir}/hyacine.yaml`];
  let config: ProjectConfig = { ...DEFAULT_PROJECT_CONFIG };
  for (const p of candidates) {
    try {
      const raw = await readTextFile(p);
      // 解析校验统一走 contract 共享 schema（与 CLI 一致）
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- yaml parse returns any
      config = parseProjectConfig(yamlParse(raw) as unknown);
      break;
    } catch {
      // try next
    }
  }
  // hyacine.yml 未声明 collections 时合并 hyc collections 产物（生成即生效）
  if (config.collections === undefined) {
    try {
      const gen = await readTextFile(`${dir}/hyacine.collections.json`);
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse any
      const file = parseCollectionsFile(JSON.parse(gen) as unknown);
      if (file !== null && file.collections.length > 0) {
        const entries: Record<string, string> = {};
        for (const c of file.collections) {
          if (c.dir.length > 0 && !Object.hasOwn(entries, c.name)) entries[c.name] = c.dir;
        }
        if (Object.keys(entries).length > 0) config = { ...config, collections: entries };
      }
    } catch {
      // 无产物或损坏 → 保持原配置
    }
  }
  return config;
}
function extractTitle(data: Record<string, unknown>, fallback: string): string {
  const t = data.title;
  if (typeof t === "string" && t.length > 0) return t;
  return fallback;
}

function extractSlug(data: Record<string, unknown>, title: string): string {
  // 显式 slug 保留中文(不清洗成 -)；退化/缺失时按标题自动生成(中文转拼音)
  return displaySlug(data.slug, title);
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
    const collections = getCollections(cfg);
    const infos: LocalPostInfo[] = [];
    const fileErrors: string[] = [];
    let totalFiles = 0;
    for (const coll of collections) {
      const contentAbs = `${dir}/${coll.dir}`;
      let files: string[];
      try {
        files = await readDirRecursive(contentAbs);
      } catch {
        continue; // 集合目录不存在 → 跳过
      }
      const mdFiles = files.filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));
      totalFiles += mdFiles.length;
      for (const full of mdFiles) {
        try {
          const raw = await readTextFile(full);
          const parsed = parseFrontmatter(raw);
          const data = parsed.data;
          const rel = full.startsWith(`${contentAbs}/`) ? full.slice(contentAbs.length + 1) : full;
          // repo 相对（含集合目录前缀）
          const repoRel = `${coll.dir}/${rel}`;
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
            path: repoRel,
            fullPath: full,
            collection: coll.name,
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
    }
    // 按 path 排序
    infos.sort((a, b) => a.path.localeCompare(b.path));
    setPosts(infos);
    if (infos.length > 0) {
      setError(null);
    } else if (totalFiles === 0) {
      setError(
        `在集合目录（${collections.map((c) => c.dir).join(", ")}）下未发现任何 .md/.mdx 文件`,
      );
    } else if (fileErrors.length > 0) {
      setError(`扫描到 ${totalFiles} 个文件但读取全部失败，前几个错误：${fileErrors.join(" | ")}`);
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
