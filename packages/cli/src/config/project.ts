import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { parseProjectConfig, type ProjectConfig } from "@hyacine/contract";

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

  try {
    // 解析与校验统一走 contract 的共享 schema（CLI/桌面/API 一致）
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- yaml parse returns any
    const parsed = parseYaml(raw) as unknown;
    return parseProjectConfig(parsed);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function resolveProjectConfig(
  startDir?: string,
): { root: string; config: ProjectConfig } | null {
  const root = findProjectRoot(startDir);
  if (root === null) return null;
  return { root, config: loadProjectConfig(root) };
}

export type { ProjectConfig }; // 重导出共享类型，cli 内引用不变
