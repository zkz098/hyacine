/**
 * hyacine.collections.json 生成编排：
 * 1. 优先运行时提取 src/content.config.ts（source=content.config.ts）
 * 2. 失败/无配置降级：读 Astro sync 产物 .astro/collections/*.schema.json（source=astro-sync-fallback）
 * 3. 写文件（项目根，默认 hyacine.collections.json）
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Collection, CollectionsFile } from "@hyacine/contract";
import { parseCollectionsFile } from "@hyacine/contract";
import type { ProjectConfig } from "../config/project";
import { extractCollections, deriveUiFields, type ExtractResult } from "./extract";

export interface GenerateOptions {
  outPath?: string;
  zodPath?: string;
  loadersPath?: string;
  /** 已存在文件也强制覆盖 */
  force?: boolean;
}

export interface GenerateResult {
  file: CollectionsFile;
  outPath: string;
  overwritten: boolean;
  /** 实际配置来源（content.config.ts | astro-sync-fallback） */
  source: CollectionsFile["source"];
}

function normalizeDir(dir: string, config: ProjectConfig): string {
  // 非 glob 兜底 '' → contentDir；统一 posix
  const d = dir.length > 0 ? dir : config.contentDir;
  return d.replace(/^\.\//, "").replace(/\\/g, "/").replace(/\/+$/, "");
}

/** 从 .astro/collections/*.schema.json 降级读取（source=astro-sync-fallback） */
export function readAstroSyncSchemas(
  root: string,
  config: ProjectConfig,
): { collections: Collection[]; warnings: string[] } {
  const warnings: string[] = [];
  const dir = join(root, ".astro", "collections");
  const out: Collection[] = [];
  if (!existsSync(dir)) {
    warnings.push("无 .astro/collections 产物（需先在博客运行 astro sync/dev/build）");
    return { collections: out, warnings };
  }
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".schema.json"));
  } catch {
    return { collections: out, warnings };
  }
  files.sort();
  for (const file of files) {
    const name = file.replace(/\.schema\.json$/, "");
    try {
      const schema = JSON.parse(readFileSync(join(dir, file), "utf8")) as Record<string, unknown>;
      // 目录猜测：src/<name> 优先，其次 contentDir
      let d = config.contentDir;
      if (existsSync(join(root, "src", name))) d = `src/${name}`;
      const jsonSchema = (schema ?? {}) as Record<string, unknown>;
      out.push({
        name,
        dir: d,
        pattern: null,
        extensions: [".md", ".mdx"],
        contentKind: "content",
        schema: jsonSchema,
        ui: { fields: deriveUiFields(jsonSchema, name) },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      warnings.push(`${file} 解析失败：${msg.slice(0, 120)}`);
    }
  }
  return { collections: out, warnings };
}

function toCollectionsFile(
  res: ExtractResult,
  config: ProjectConfig,
  source: CollectionsFile["source"],
): CollectionsFile {
  const collections: Collection[] = res.collections.map((c) => ({
    name: c.name,
    dir: normalizeDir(c.dir, config),
    pattern: c.pattern,
    extensions: c.extensions.filter((e) => e.length > 0),
    contentKind: c.contentKind,
    schema: (c.jsonSchema ?? {}) as Record<string, unknown>,
    ui: { fields: c.fields },
  }));
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source,
    collections,
    warnings: res.warnings,
  };
}

/**
 * 生成并写 hyacine.collections.json。
 * 弱于已存在文件（旧 real 提取 vs 本次降级）且未 force 时保留旧文件。
 */
export async function generateCollectionsFile(
  root: string,
  config: ProjectConfig,
  options: GenerateOptions = {},
): Promise<GenerateResult | null> {
  const outPath = join(root, options.outPath ?? "hyacine.collections.json");

  let res = await extractCollections(root, {
    zodPath: options.zodPath,
    loadersPath: options.loadersPath,
  });

  // 降级：提取失败/无配置 → 读 Astro sync 产物
  if (res.source === "astro-sync-fallback" || res.collections.length === 0) {
    const fallback = readAstroSyncSchemas(root, config);
    res = {
      root,
      configPath: res.configPath,
      source: "astro-sync-fallback",
      collections: [],
      warnings: [...res.warnings, ...fallback.warnings],
    };
    const file: CollectionsFile = {
      version: 1,
      generatedAt: new Date().toISOString(),
      source: "astro-sync-fallback",
      collections: fallback.collections,
      warnings: res.warnings,
    };
    return writeOrKeep(file, outPath, options);
  }

  const file = toCollectionsFile(res, config, "content.config.ts");
  return writeOrKeep(file, outPath, options);
}

function writeOrKeep(
  file: CollectionsFile,
  outPath: string,
  options: GenerateOptions,
): GenerateResult {
  const exists = existsSync(outPath);
  if (!options.force && exists && file.source === "astro-sync-fallback") {
    // 保留旧的更强来源（content.config.ts）
    try {
      const existing = parseCollectionsFile(JSON.parse(readFileSync(outPath, "utf8")));
      if (existing !== null && existing.source === "content.config.ts") {
        return { file: existing, outPath, overwritten: false, source: existing.source };
      }
    } catch {
      // 旧文件损坏 → 覆盖
    }
  }
  writeFileSync(outPath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  return { file, outPath, overwritten: exists, source: file.source };
}
