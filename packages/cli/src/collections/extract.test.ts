import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { parseCollectionsFile } from "@hyacine/contract";
import { extensionsFromPattern, extractCollections } from "./extract";
import { generateCollectionsFile, readAstroSyncSchemas } from "./generate";
import { DEFAULT_PROJECT_CONFIG } from "@hyacine/contract";

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

function makeTmpDir(): string {
  const d = mkdtempSync(join(tmpdir(), "hyacine-cols-test-"));
  tmpDirs.push(d);
  return d;
}

/** cli 自身 zod（与提取器 alias 目标同实例） */
function cliZodPath(): string {
  const require = createRequire(import.meta.url);
  const pkgDir = dirname(require.resolve("zod/package.json"));
  return join(pkgDir, "index.js");
}

/** 测试用 fake glob loader（记录 base/pattern，返回最小 loader 对象） */
function fakeLoadersPath(root: string): string {
  const p = join(root, "test-loaders.ts");
  writeFileSync(
    p,
    [
      `export const glob = (opts) => {`,
      `  const key = "__hyacineLoaderRegistry__";`,
      `  (globalThis[key] ??= []).push({ base: opts.base, pattern: opts.pattern, loader: undefined });`,
      `  return { name: "glob-loader", load: async () => undefined };`,
      `};`,
      `export const file = (id) => ({ name: "file-loader", load: async () => undefined, id });`,
      `export const json = (o) => ({ name: "json-loader", load: async () => undefined, ...o });`,
    ].join("\n"),
    "utf8",
  );
  return p;
}

/** 双集合 fixture（posts 用 schema 函数 + 包装 loader——模拟 withFolderCategories） */
function makeBlogFixture(): { root: string; loadersPath: string } {
  const root = makeTmpDir();
  mkdirSync(join(root, "src", "posts"), { recursive: true });
  mkdirSync(join(root, "src", "moments"), { recursive: true });
  const config = join(root, "src", "content.config.ts");
  writeFileSync(
    config,
    [
      `import { glob } from "astro/loaders";`,
      `import { defineCollection, image } from "astro:content";`,
      `import { z } from "astro/zod";`,
      ``,
      `const FOLDER_TOKEN = ${JSON.stringify("${folder}")};`,
      ``,
      `/** 模拟 withFolderCategories：展开 glob 为新对象（名称保留 glob-loader 前缀） */`,
      `const withFolderCategories = (loader) => ({`,
      `  ...loader,`,
      `  name: loader.name + "-folder-categories",`,
      `  async load(context) { return loader.load(context); },`,
      `});`,
      ``,
      `const posts = defineCollection({`,
      `  loader: withFolderCategories(`,
      `    glob({ pattern: "**/*.{md,mdx}", base: "src/posts" }),`,
      `  ),`,
      `  schema: ({ image }) =>`,
      `    z.object({`,
      `      title: z.string(),`,
      `      description: z.string().optional(),`,
      `      date: z.date(),`,
      `      tags: z.array(z.string()).nullable().optional(),`,
      `      categories: z.preprocess(`,
      `        (c) => (c === FOLDER_TOKEN ? [FOLDER_TOKEN] : c),`,
      `        z.array(z.string()).nullable().optional(),`,
      `      ),`,
      `      draft: z.boolean().optional(),`,
      `      cover: image().optional(),`,
      `      license: z.enum(["CC-BY-4.0", "CC-BY-NC-4.0"]).optional(),`,
      `      encrypted: z.boolean().default(false),`,
      `      password: z.string().optional(),`,
      `    }),`,
      `});`,
      ``,
      `const moments = defineCollection({`,
      `  loader: glob({ pattern: "**/*.{md,mdx}", base: "src/moments" }),`,
      `  schema: z.object({`,
      `    date: z.date(),`,
      `    images: z.array(z.union([z.string(), image()])).optional(),`,
      `  }),`,
      `});`,
      ``,
      `export const collections = { posts, moments };`,
    ].join("\n"),
    "utf8",
  );
  return { root, loadersPath: fakeLoadersPath(root) };
}

describe("extractCollections（运行时提取 src/content.config.ts）", () => {
  it("提取双集合：dir/pattern/扩展名/来源", async () => {
    const { root, loadersPath } = makeBlogFixture();
    const res = await extractCollections(root, { zodPath: cliZodPath(), loadersPath });
    expect(res.source).toBe("content.config.ts");
    expect(res.collections.map((c) => c.name)).toEqual(["posts", "moments"]);
    const posts = res.collections[0]!;
    expect(posts.dir).toBe("src/posts");
    expect(posts.pattern).toBe("**/*.{md,mdx}");
    expect(posts.extensions).toEqual([".md", ".mdx"]);
    expect(posts.contentKind).toBe("content");
    expect(res.collections[1]!.dir).toBe("src/moments");
    expect(res.warnings).toEqual([]);
  });

  it("包装 loader（名称含 glob-loader）按顺序匹配 base", async () => {
    const { root, loadersPath } = makeBlogFixture();
    const res = await extractCollections(root, { zodPath: cliZodPath(), loadersPath });
    expect(res.collections[0]!.dir).toBe("src/posts");
  });

  it("JSON Schema：required/enum/default/cover 类型（与 Astro 生成机制一致）", async () => {
    const { root, loadersPath } = makeBlogFixture();
    const res = await extractCollections(root, { zodPath: cliZodPath(), loadersPath });
    const posts = res.collections[0]!;
    const s = posts.jsonSchema!;
    expect(s.required).toEqual(["title", "date"]);
    const props = s.properties as Record<
      string,
      { type?: string; format?: string; enum?: string[] }
    >;
    expect(props.date).toEqual({
      type: "string",
      format: "date-time",
      "x-hyacine-hint": expect.any(String),
    });
    expect(props.cover?.type).toBe("string");
    expect(props.license?.enum).toEqual(["CC-BY-4.0", "CC-BY-NC-4.0"]);
    expect(props.encrypted).toMatchObject({ type: "boolean", default: false });
    expect(props.password?.type).toBe("string");
  });

  it("UI 字段：date/string[]/enum 推导 + secret/image 标记", async () => {
    const { root, loadersPath } = makeBlogFixture();
    const res = await extractCollections(root, { zodPath: cliZodPath(), loadersPath });
    const posts = res.collections[0]!;
    const byKey = new Map(posts.fields.map((f) => [f.key, f]));
    expect(byKey.get("title")).toMatchObject({ kind: "string", required: true });
    expect(byKey.get("date")).toMatchObject({ kind: "date", required: true });
    expect(byKey.get("tags")?.kind).toBe("string[]");
    expect(byKey.get("license")).toMatchObject({
      kind: "enum",
      values: ["CC-BY-4.0", "CC-BY-NC-4.0"],
    });
    expect(byKey.get("cover")?.image).toBe(true);
    expect(byKey.get("password")?.secret).toBe(true);
    expect(byKey.get("encrypted")?.hasDefault).toBe(true);
    const moments = res.collections[1]!;
    const momentFields = new Map(moments.fields.map((f) => [f.key, f]));
    expect(momentFields.get("images")).toMatchObject({ kind: "string[]", image: true });
  });
});

describe("extensionsFromPattern", () => {
  it("解析 {md,mdx}", () => {
    expect(extensionsFromPattern("**/*.{md,mdx}")).toEqual([".md", ".mdx"]);
    expect(extensionsFromPattern("**/*.{md}")).toEqual([".md"]);
  });
  it("解析 *.json / 兜底", () => {
    expect(extensionsFromPattern("**/*.json")).toEqual([".json"]);
    expect(extensionsFromPattern("**/*.md")).toEqual([".md"]);
    expect(extensionsFromPattern("**/*.{md}")).toEqual([".md"]);
    expect(extensionsFromPattern("**/*")).toEqual([".md", ".mdx"]);
  });
});

describe("降级路径", () => {
  it("无 content.config.ts → 读 .astro/collections/*.schema.json（source=astro-sync-fallback）", async () => {
    const root = makeTmpDir();
    mkdirSync(join(root, "src", "moments"), { recursive: true });
    mkdirSync(join(root, ".astro", "collections"), { recursive: true });
    writeFileSync(
      join(root, ".astro", "collections", "moments.schema.json"),
      JSON.stringify({
        type: "object",
        properties: { date: { type: "string", format: "date-time" } },
        required: ["date"],
      }),
      "utf8",
    );
    const res = await extractCollections(root, {
      zodPath: cliZodPath(),
      loadersPath: fakeLoadersPath(root),
    });
    expect(res.source).toBe("astro-sync-fallback");
    expect(res.collections.length).toBe(0);

    const generated = await generateCollectionsFile(root, DEFAULT_PROJECT_CONFIG, { force: true });
    expect(generated?.source).toBe("astro-sync-fallback");
    const file = generated!.file;
    expect(file.collections.length).toBe(1);
    expect(file.collections[0]!.name).toBe("moments");
    expect(file.collections[0]!.dir).toBe("src/moments");
    const fields = file.collections[0]!.ui.fields;
    expect(fields.find((f) => f.key === "date")?.kind).toBe("date");
  });
});

describe("generateCollectionsFile", () => {
  it("写文件且可被 contract 解析；周而复始弱来源不覆盖强来源", async () => {
    const { root, loadersPath } = makeBlogFixture();
    const r1 = await generateCollectionsFile(root, DEFAULT_PROJECT_CONFIG, {
      zodPath: cliZodPath(),
      loadersPath,
    });
    expect(r1?.source).toBe("content.config.ts");
    expect(existsSync(join(root, "hyacine.collections.json"))).toBe(true);
    const parsed = parseCollectionsFile(
      JSON.parse(readFileSync(join(root, "hyacine.collections.json"), "utf8")),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.collections.map((c) => c.name)).toEqual(["posts", "moments"]);
    expect(parsed!.collections[0]!.dir).toBe("src/posts");

    // 再次生成（弱来源）不应覆盖已有强来源文件
    const onlyAstro = makeTmpDir();
    mkdirSync(join(onlyAstro, ".astro", "collections"), { recursive: true });
    writeFileSync(
      join(onlyAstro, ".astro", "collections", "x.schema.json"),
      JSON.stringify({ type: "object", properties: {}, required: [] }),
      "utf8",
    );
    writeFileSync(
      join(onlyAstro, "hyacine.collections.json"),
      JSON.stringify({
        version: 1,
        generatedAt: "2026-01-01T00:00:00.000Z",
        source: "content.config.ts",
        collections: [],
        warnings: [],
      }),
      "utf8",
    );
    const r2 = await generateCollectionsFile(onlyAstro, DEFAULT_PROJECT_CONFIG, {});
    expect(r2?.overwritten).toBe(false);
    expect(r2?.file.generatedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("readAstroSyncSchemas", () => {
  it("目录猜测 src/<name> 优先", () => {
    const root = makeTmpDir();
    mkdirSync(join(root, "src", "posts"), { recursive: true });
    mkdirSync(join(root, ".astro", "collections"), { recursive: true });
    writeFileSync(
      join(root, ".astro", "collections", "posts.schema.json"),
      JSON.stringify({
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"],
      }),
      "utf8",
    );
    const { collections } = readAstroSyncSchemas(root, DEFAULT_PROJECT_CONFIG);
    expect(collections[0]).toMatchObject({
      name: "posts",
      dir: "src/posts",
      contentKind: "content",
    });
  });
});
