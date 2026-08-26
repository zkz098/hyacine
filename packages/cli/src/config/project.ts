import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { parseCollectionsFile, parseProjectConfig, type ProjectConfig } from "@hyacine/contract";

const DEFAULT_CONFIG: ProjectConfig = {
  contentDir: "src/posts",
  assetsDir: "src/assets",
  postExtension: [".md", ".mdx"],
  themeConfigPath: null,
};

export function findProjectRoot(startDir: string = process.cwd()): string | null {
  let dir = resolve(startDir);
  let packageFallback: string | null = null;
  for (;;) {
    if (existsSync(join(dir, "hyacine.yml")) || existsSync(join(dir, "hyacine.yaml"))) {
      return dir;
    }
    // 只把最近的 package.json 当兜底，不在这里提前返回（否则子目录自带
    // package.json 时会误判项目根，漏掉更上层真正的 hyacine.yml）。
    if (packageFallback === null && existsSync(join(dir, "package.json"))) {
      packageFallback = dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return packageFallback;
    dir = parent;
  }
}

export function loadProjectConfig(projectRoot: string): ProjectConfig {
  const ymlPath = join(projectRoot, "hyacine.yml");
  const yamlPath = join(projectRoot, "hyacine.yaml");
  let raw: string | null = null;
  if (existsSync(ymlPath)) raw = readFileSync(ymlPath, "utf8");
  else if (existsSync(yamlPath)) raw = readFileSync(yamlPath, "utf8");
  else return { ...DEFAULT_CONFIG };

  let config: ProjectConfig;
  try {
    // 解析与校验统一走 contract 的共享 schema（CLI/桌面/API 一致）
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- yaml parse returns any
    const parsed = parseYaml(raw) as unknown;
    config = parseProjectConfig(parsed);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
  return mergeGeneratedCollections(projectRoot, config);
}

/**
 * hyacine.yml 未声明 collections 时，合并 hyacine.collections.json（hyc collections
 * 产物）的 name→dir，实现「生成即生效」；显式注册表优先，产物缺失/损坏则原样返回。
 */
export function mergeGeneratedCollections(
  projectRoot: string,
  config: ProjectConfig,
): ProjectConfig {
  if (config.collections !== undefined) return config;
  const genPath = join(projectRoot, "hyacine.collections.json");
  if (!existsSync(genPath)) return config;
  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON.parse any
    const file = parseCollectionsFile(JSON.parse(readFileSync(genPath, "utf8")) as unknown);
    if (file === null || file.collections.length === 0) return config;
    const entries: Record<string, string> = {};
    for (const c of file.collections) {
      if (c.dir.length > 0 && !Object.hasOwn(entries, c.name)) entries[c.name] = c.dir;
    }
    if (Object.keys(entries).length === 0) return config;
    return { ...config, collections: entries };
  } catch {
    return config;
  }
}

export function resolveProjectConfig(
  startDir?: string,
): { root: string; config: ProjectConfig } | null {
  const root = findProjectRoot(startDir);
  if (root === null) return null;
  return { root, config: loadProjectConfig(root) };
}

import { execFileSync } from "node:child_process";

export function resolveProjectId(
  projectRoot: string,
  config?: ProjectConfig,
): string | undefined {
  if (config?.projectId && config.projectId.trim().length > 0) {
    return config.projectId.trim();
  }
  try {
    const raw = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (raw.length > 0) {
      const match = raw.match(/github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?$/i);
      if (match && match[1] && match[2]) {
        return `github:${match[1]}/${match[2]}`;
      }
      const generic = raw
        .replace(/^https?:\/\//, "")
        .replace(/\.git$/, "")
        .replace(/:/, "/");
      return `git:${generic}`;
    }
  } catch {
    // 忽略未配置 git 或无 remote
  }
  return undefined;
}

export type { ProjectConfig }; // 重导出共享类型，cli 内引用不变
