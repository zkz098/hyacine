import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

export interface ProjectConfig {
  contentDir: string;
  assetsDir: string;
  postExtension: string[];
  themeConfigPath: string | null;
}

const DEFAULT_CONFIG: ProjectConfig = {
  contentDir: "src/posts",
  assetsDir: "src/assets",
  postExtension: [".md", ".mdx"],
  themeConfigPath: null,
};

export function findProjectRoot(startDir: string = process.cwd()): string | null {
  let dir = resolve(startDir);
  const root = dirname(dir) === dir ? dir : "";
  while (true) {
    if (existsSync(join(dir, "hyacine.yml")) || existsSync(join(dir, "hyacine.yaml"))) {
      return dir;
    }
    if (existsSync(join(dir, "package.json"))) {
      // Treat package.json dir as project root fallback
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
    if (root && dir === root) return null;
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
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- yaml parse returns any
    const parsed = parseYaml(raw) as Record<string, unknown>;
    const cfg: ProjectConfig = { ...DEFAULT_CONFIG };
    if (typeof parsed.contentDir === "string") cfg.contentDir = parsed.contentDir;
    if (typeof parsed.assetsDir === "string") cfg.assetsDir = parsed.assetsDir;
    if (Array.isArray(parsed.postExtension)) {
      cfg.postExtension = parsed.postExtension.filter((x): x is string => typeof x === "string");
    }
    if (typeof parsed.themeConfigPath === "string") cfg.themeConfigPath = parsed.themeConfigPath;
    return cfg;
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
