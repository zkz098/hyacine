/**
 * Astro 内容集合运行时提取器。
 *
 * 原理：`src/content.config.ts` 是 Astro 集合的事实源（zod schema + glob loader），
 * 但依赖虚拟模块 astro:content / astro/zod / astro/loaders，不能在 Node 直接加载。
 * 本模块用 jiti 在博客项目根上下文加载配置，并通过 alias 注入两个 shim：
 * - astro:content → defineCollection 原样返回 + image() 按 Astro generateJSONSchema
 *   同款语义降级为 z.string()；
 * - astro/loaders → 包装 glob()，把 base/pattern 记录到 globalThis 注册表
 *   （glob loader 把 base/pattern 藏在 load 闭包里，不 shim 无法读取）。
 * astro/zod → 直接映射博客真实 astro 的 dist/zod.js，保证 schema 实例与 z 同源。
 */
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";
import { createJiti } from "jiti";
import type { CollectionContentKind, CollectionsFile } from "@hyacine/contract";

/** 提取产物：每个集合的可序列化描述（contract Collection 的直接素材） */
export interface ExtractedCollection {
  name: string;
  dir: string;
  pattern: string | null;
  extensions: string[];
  contentKind: CollectionContentKind;
  jsonSchema: Record<string, unknown> | null;
  fields: import("@hyacine/contract").CollectionFieldUi[];
  warnings: string[];
}

export interface ExtractResult {
  root: string;
  configPath: string | null;
  source: CollectionsFile["source"];
  collections: ExtractedCollection[];
  warnings: string[];
}

interface GlobRecord {
  base: string;
  pattern: string;
  loader: unknown;
}

const REGISTRY_KEY = "__hyacineLoaderRegistry__";

// ---- shim 内容（内联字符串，运行时写到临时目录；避免打包后无静态文件可读） ------

function astroContentShimSource(): string {
  return [
    `import { z } from "astro/zod";`,
    `export const defineCollection = (config) => config;`,
    `/** image() 降级为 string（与 Astro 生成 JSON Schema 的语义一致） */`,
    `export const image = () => z.string();`,
    `export { z };`,
    `export const globalRegistry = { get() { return undefined; }, set() {}, add() {} };`,
  ].join("\n");
}

function astroLoadersShimSource(): string {
  return [
    `import * as real from "astro/loaders/real";`,
    `const key = ${JSON.stringify(REGISTRY_KEY)};`,
    `export const glob = (opts) => {`,
    `  const loader = real.glob(opts);`,
    `  (globalThis[key] ??= []).push({ base: opts.base, pattern: opts.pattern, loader });`,
    `  return loader;`,
    `};`,
    `export * from "astro/loaders/real";`,
  ].join("\n");
}

const ASTRO_CONTENT_SPECIFIER = "astro:content";
const ASTRO_LOADERS_SPECIFIER = "astro/loaders";
/** shim 内部指向真实 astro/loaders 的别名键（避免 'astro/loaders' 自引用循环） */
const ASTRO_LOADERS_REAL_SPECIFIER = "astro/loaders/real";

export interface ExtractOptions {
  /** 覆盖 astro/zod 解析路径（默认博客根 require.resolve('astro/zod')；测试注入 cli zod） */
  zodPath?: string;
  /** 覆盖 astro/loaders 解析路径（默认博客根 require.resolve('astro/loaders')） */
  loadersPath?: string;
  /** 覆盖集合配置文件路径 */
  configPath?: string;
}

function resolveModuleFrom(root: string, specifier: string): string | null {
  try {
    return createRequire(join(root, "package.json")).resolve(specifier);
  } catch {
    return null;
  }
}

function findContentConfig(root: string): string | null {
  const candidates = [
    "src/content.config.ts",
    "src/content.config.mjs",
    "src/content/config.ts",
    "src/content/config.mjs",
    "src/content/config.js",
  ];
  for (const rel of candidates) {
    const full = join(root, rel);
    if (existsSync(full)) return full;
  }
  return null;
}

/** 从 glob pattern 推导扩展名（"**\/*.{md,mdx}" → [".md",".mdx"]） */
export function extensionsFromPattern(pattern: string): string[] {
  const braces = /\.\{([^}]+)\}/.exec(pattern);
  if (braces !== null) {
    return braces[1]!
      .split(/[|,]/)
      .map((s) => s.trim().replace(/^\*/, ""))
      .filter(Boolean)
      .map((s) => (s.startsWith(".") ? s : `.${s}`));
  }
  const star = /\.\*\.([A-Za-z0-9]+)/.exec(pattern);
  if (star !== null) return [`.${star[1]}`];
  const single = /\.(md|mdx|json|yaml|yml)$/.exec(pattern);
  if (single !== null) return [`.${single[1]}`];
  return [".md", ".mdx"];
}

/** identity → 名称包含 → 定义顺序 三级匹配记录 */
function matchGlobRecord(
  reg: GlobRecord[],
  loader: unknown,
  loaderName: unknown,
  consumed: Set<GlobRecord>,
): GlobRecord | null {
  if (loader !== undefined && loader !== null) {
    const byId = reg.find((r) => r.loader === loader && !consumed.has(r));
    if (byId !== undefined) return byId;
  }
  if (typeof loaderName === "string" && loaderName.includes("glob-loader")) {
    // 包装 loader（如 withFolderCategories 展开 glob 为新对象）：按定义顺序取首个未消费 glob
    const firstGlob = reg.find((r) => !consumed.has(r));
    if (firstGlob !== undefined) return firstGlob;
  }
  return null;
}

/**
 * 主入口：在 root（博客项目根）提取内容集合。
 * 提取失败（无配置文件 / astro 未安装 / 加载异常）返回 source=astro-sync-fallback 的
 * 空结果由调用方走降级（读 .astro/collections/*.schema.json）。
 */
export async function extractCollections(
  root: string,
  options: ExtractOptions = {},
): Promise<ExtractResult> {
  const warnings: string[] = [];
  const configPath = options.configPath ?? findContentConfig(root);
  if (configPath === null) {
    warnings.push("未找到 src/content.config.ts / src/content/config.ts");
    return { root, configPath: null, source: "astro-sync-fallback", collections: [], warnings };
  }

  const zodPath = options.zodPath ?? resolveModuleFrom(root, "astro/zod");
  const loadersPath = options.loadersPath ?? resolveModuleFrom(root, "astro/loaders");
  if (zodPath === null || loadersPath === null) {
    warnings.push(
      `astro 模块解析失败（zod=${zodPath === null ? "缺失" : "ok"}, loaders=${loadersPath === null ? "缺失" : "ok"}），走降级`,
    );
    return { root, configPath, source: "astro-sync-fallback", collections: [], warnings };
  }

  const tmpDir = mkdtempSync(join(tmpdir(), "hyacine-cols-"));
  const contentShim = join(tmpDir, "astro-content.ts");
  const loadersShim = join(tmpDir, "astro-loaders.ts");
  try {
    writeFileSync(contentShim, astroContentShimSource(), "utf8");
    writeFileSync(loadersShim, astroLoadersShimSource(), "utf8");

    const jiti = createJiti(import.meta.url, {
      alias: {
        [ASTRO_CONTENT_SPECIFIER]: contentShim,
        [ASTRO_LOADERS_SPECIFIER]: loadersShim,
        [ASTRO_LOADERS_REAL_SPECIFIER]: loadersPath,
        "astro/zod": zodPath,
      },
      moduleCache: false,
      fsCache: false,
      interopDefault: true,
      cache: false,
    });

    // 加载配置；z 取自 astro/zod（与配置构建 schema 同一实例）
    const mod = (await jiti.import(configPath, { default: true })) as unknown;
    const zRef = (await jiti.import(contentShim, { default: true })) as {
      z: typeof import("zod");
    };
    const z = zRef.z;

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 动态模块
    const collections =
      (mod as { collections?: unknown })?.collections ??
      (mod as { default?: { collections?: unknown } })?.default?.collections;
    if (collections === undefined || collections === null || typeof collections !== "object") {
      warnings.push("content.config.ts 未导出 collections");
      return { root, configPath, source: "astro-sync-fallback", collections: [], warnings };
    }

    const reg = (globalThis as Record<string, unknown>)[REGISTRY_KEY] as GlobRecord[] | undefined;
    const registry: GlobRecord[] = Array.isArray(reg) ? reg : [];
    const consumed = new Set<GlobRecord>();

    const out: ExtractedCollection[] = [];
    for (const [name, rawConfig] of Object.entries(collections as Record<string, unknown>)) {
      const collWarnings: string[] = [];
      const collObj = (rawConfig ?? {}) as Record<string, unknown>;
      const loader = collObj.loader;
      const loaderName =
        typeof loader === "object" && loader !== null
          ? (loader as { name?: unknown }).name
          : undefined;
      const rec = matchGlobRecord(registry, loader, loaderName, consumed);
      const dir = rec?.base ?? fallbackDir(root, name);
      const pattern = rec?.pattern ?? null;
      const extensions = pattern !== null ? extensionsFromPattern(pattern) : [".md", ".mdx"];
      if (rec === null) {
        collWarnings.push(
          `集合 ${name} 未能匹配 glob 记录（loader=${String(loaderName ?? "?")}），目录用兜底 "${dir}"`,
        );
      }
      if (rec !== null) consumed.add(rec);

      // schema：coll.schema 或 loader.schema；函数式按 Astro 语义注入 image
      const schemaSpec =
        collObj.schema ??
        (typeof loader === "object" && loader !== null
          ? (loader as { schema?: unknown }).schema
          : undefined);
      const contentKind: CollectionContentKind =
        collObj.type === "data"
          ? "data"
          : collObj.type === "content" || loader !== undefined
            ? "content"
            : "unknown";

      let jsonSchema: Record<string, unknown> | null = null;
      if (schemaSpec === undefined) {
        collWarnings.push(`集合 ${name} 无 schema（UI/校验将退化为通用 frontmatter）`);
      } else {
        const zodSchema =
          typeof schemaSpec === "function"
            ? ((schemaSpec as (opts: { image: () => unknown }) => unknown)({
                image: () => z.string(),
              }) as import("zod").ZodType)
            : (schemaSpec as import("zod").ZodType);
        jsonSchema = toInputJsonSchema(z, zodSchema, name, collWarnings);
      }

      const fields = deriveUiFields(jsonSchema, name);
      out.push({
        name,
        dir,
        pattern,
        extensions,
        contentKind,
        jsonSchema,
        fields,
        warnings: collWarnings,
      });
    }
    warnings.push(...out.flatMap((c) => c.warnings));
    return { root, configPath, source: "content.config.ts", collections: out, warnings };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    warnings.push(`提取失败（${msg.slice(0, 200)}），走降级读取 Astro sync 产物`);
    return { root, configPath, source: "astro-sync-fallback", collections: [], warnings };
  } finally {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // 忽略清理失败
    }
  }
}

/** 非 glob loader 集合的目录兜底：src/<name> 存在则用它，否则空（由调用方再兜底 contentDir） */
function fallbackDir(root: string, name: string): string {
  const candidates = [`src/${name}`, `content/${name}`];
  for (const rel of candidates) {
    if (existsSync(join(root, rel))) return rel;
  }
  // 博客根可能直接是内容目录（contentDir 顶层）
  return "";
}

const DATE_INPUT_HINT = "YYYY-MM-DD 或 ISO 时间";

/** 与 Astro generateJSONSchema 同机制：io=input 形状，date→string/date-time，注入 $schema */
export function toInputJsonSchema(
  z: typeof import("zod"),
  zodSchema: import("zod").ZodType,
  name: string,
  warnings: string[],
): Record<string, unknown> | null {
  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion, typescript/no-explicit-any -- zod 动态
    const zs = zodSchema as any;
    let target = zodSchema;
    if (typeof zs.extend === "function") {
      target = zs.extend({ $schema: z.string().optional() }) as import("zod").ZodType;
    }
    const json = z.toJSONSchema(target, {
      unrepresentable: "any",
      io: "input",
      // oxlint-disable-next-line no-underscore-dangle -- zod v4 内部 def（Astro 同款读取）
      override: (ctx) => {
        // oxlint-disable-next-line no-underscore-dangle -- 同上
        const def = (ctx.zodSchema as { _zod?: { def?: { type?: string } } } | undefined)?._zod
          ?.def;
        if (def?.type === "date" || ctx.zodSchema instanceof z.ZodDate) {
          ctx.jsonSchema.type = "string";
          ctx.jsonSchema.format = "date-time";
          ctx.jsonSchema["x-hyacine-hint"] = DATE_INPUT_HINT;
        }
      },
    });
    return json as Record<string, unknown>;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    warnings.push(`集合 ${name} schema 无法 JSON 化（${msg.slice(0, 120)}），跳过`);
    return null;
  }
}

// ---- UI 字段描述（从 JSON Schema 推导，避开 zod 内部结构） --------------------

const SECRET_KEYS = new Set(["password", "secret", "token", "api_key", "apikey", "access_key"]);
const IMAGE_KEYS = new Set([
  "cover",
  "thumbnail",
  "avatar",
  "poster",
  "banner",
  "hero",
  "image",
  "images",
  "og_image",
]);

export function isSecretKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SECRET_KEYS.has(lower) || lower.includes("password") || lower.includes("secret");
}

export function isImageKey(key: string): boolean {
  const lower = key.toLowerCase();
  return IMAGE_KEYS.has(lower) || lower.endsWith("image") || lower.endsWith("cover");
}

type JsonSchemaProp = {
  type?: string | string[];
  format?: string;
  enum?: unknown[];
  items?: JsonSchemaProp;
  anyOf?: JsonSchemaProp[];
  description?: string;
  [k: string]: unknown;
};

function propKind(p: JsonSchemaProp): {
  kind: import("@hyacine/contract").CollectionFieldKind;
  values?: string[];
} {
  if (Array.isArray(p.anyOf) && p.anyOf.length > 0) {
    // nullable/union：取非 null 分支语义，enum 合并
    const branches = p.anyOf.filter((b) => b.type !== "null");
    let values: string[] | undefined;
    for (const b of p.anyOf) {
      if (Array.isArray(b.enum)) values = b.enum.map(String);
    }
    if (branches.length === 0) return { kind: "unknown" };
    if (branches.length === 1) {
      const inner = propKind(branches[0]!);
      if (values !== undefined && inner.kind === "string") return { kind: "enum", values };
      return inner;
    }
    const allString = branches.every((b) => b.type === "string" || Array.isArray(b.enum));
    if (allString) return values !== undefined ? { kind: "enum", values } : { kind: "string" };
    return { kind: "unknown" };
  }
  if (p.type === "boolean") return { kind: "boolean" };
  if (p.type === "number" || p.type === "integer") return { kind: "number" };
  if (p.type === "array") {
    const items = p.items;
    if (
      items !== undefined &&
      (items.type === "string" ||
        (Array.isArray(items.anyOf) && items.anyOf.every((b) => b.type === "string")))
    ) {
      return { kind: "string[]" };
    }
    if (items !== undefined && (items.type === "number" || items.type === "integer")) {
      return { kind: "number[]" };
    }
    return { kind: "unknown[]" as import("@hyacine/contract").CollectionFieldKind };
  }
  if (p.type === "string") {
    if (p.format === "date-time") return { kind: "date" };
    if (Array.isArray(p.enum) && p.enum.length > 0)
      return { kind: "enum", values: p.enum.map(String) };
    return { kind: "string" };
  }
  if (p.type === "object") return { kind: "object" };
  if (Array.isArray(p.enum) && p.enum.length > 0)
    return { kind: "enum", values: p.enum.map(String) };
  return { kind: "unknown" };
}

/** 从输入形状 JSON Schema 推导表单字段描述（供 Editor 渲染器/校验提示） */
export function deriveUiFields(
  jsonSchema: Record<string, unknown> | null,
  _collectionName: string,
): import("@hyacine/contract").CollectionFieldUi[] {
  if (jsonSchema === null) return [];
  const props = (jsonSchema.properties ?? {}) as Record<string, JsonSchemaProp>;
  const required = new Set<string>(
    Array.isArray(jsonSchema.required) ? (jsonSchema.required as string[]) : [],
  );
  const fields: import("@hyacine/contract").CollectionFieldUi[] = [];
  for (const [key, p] of Object.entries(props)) {
    if (key === "$schema") continue;
    const { kind, values } = propKind(p);
    const field: import("@hyacine/contract").CollectionFieldUi = {
      key,
      kind,
      required: required.has(key),
      hasDefault: Object.prototype.hasOwnProperty.call(p, "default"),
    };
    if (isSecretKey(key)) field.secret = true;
    if (isImageKey(key)) field.image = true;
    if (values !== undefined && values.length > 0) field.values = values;
    if (typeof p.description === "string" && p.description.length > 0) {
      field.description = p.description;
    }
    fields.push(field);
  }
  return fields;
}
