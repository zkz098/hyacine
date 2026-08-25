import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";
import matter from "gray-matter";
import { postBodyHash } from "../hash";
import { displaySlug, autoSlug, getCollections } from "@hyacine/contract";
import type { PostIndexEntry } from "@hyacine/contract";
import type { ProjectConfig } from "../config/project";

/** 有效集合目录列表（repo 相对） */
export function collectionDirs(config: ProjectConfig): string[] {
  return getCollections(config).map((c) => c.dir);
}

/**
 * 扫描内容：path = repo 相对路径（如 src/posts/hello.md、src/moments/foo.md），
 * 与 API 的 export/远程编辑、git workflow 天然一致（无需目录映射）。
 */
export function scanPosts(projectRoot: string, config: ProjectConfig): PostIndexEntry[] {
  const entries: PostIndexEntry[] = [];
  const seen = new Set<string>();
  for (const dir of collectionDirs(config)) {
    const absDir = join(projectRoot, dir);
    if (!existsSync(absDir)) continue;
    for (const file of collectFiles(absDir, config.postExtension)) {
      const rel = relative(projectRoot, file).replace(/\\/g, "/");
      if (seen.has(rel)) continue;
      seen.add(rel);
      const raw = readFileSync(file, "utf8");
      const stat = statSync(file);
      const parsed = matter(raw);
      const data = parsed.data as Record<string, unknown>;
      const title =
        typeof data.title === "string" && data.title.length > 0
          ? data.title
          : basename(file, extname(file));
      // 显示用：显式 slug 保留中文(不二次 ASCII 化)，退化/缺失时按标题生成(中文转拼音)
      const slug = displaySlug(data.slug, title);
      const draft = data.draft === true;
      let categories: string[] = [];
      if (Array.isArray(data.categories))
        categories = data.categories.filter((x): x is string => typeof x === "string");
      else if (typeof data.categories === "string" && data.categories.length > 0)
        categories = [data.categories];
      const hash = postBodyHash(raw);
      const iso = stat.mtime.toISOString();
      entries.push({
        path: rel,
        slug,
        title,
        draft,
        categories,
        hash,
        createdAt: iso,
        updatedAt: iso,
        lastModified: iso,
      });
    }
  }
  return entries;
}

function collectFiles(dir: string, extensions: string[]): string[] {
  const result: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectFiles(full, extensions));
    } else if (entry.isFile()) {
      const ext = extname(entry.name);
      if (extensions.includes(ext)) result.push(full);
    }
  }
  return result;
}

export function findPostByQuery(
  projectRoot: string,
  config: ProjectConfig,
  query: string,
): string | null {
  const lower = query.toLowerCase();
  for (const dir of collectionDirs(config)) {
    const absDir = join(projectRoot, dir);
    if (!existsSync(absDir)) continue;
    for (const file of collectFiles(absDir, config.postExtension)) {
      const rel = relative(projectRoot, file).replace(/\\/g, "/");
      if (rel.toLowerCase().includes(lower)) return file;
      const raw = readFileSync(file, "utf8");
      const parsed = matter(raw);
      const data = parsed.data as Record<string, unknown>;
      const title = typeof data.title === "string" ? data.title.toLowerCase() : "";
      const slug = typeof data.slug === "string" ? data.slug.toLowerCase() : "";
      if (title.includes(lower) || slug.includes(lower)) return file;
    }
  }
  return null;
}

export function createPost(
  projectRoot: string,
  config: ProjectConfig,
  title: string,
  categories: string[] = [],
  draft = true,
): string {
  const [first] = getCollections(config);
  const contentDir = join(projectRoot, first?.dir ?? config.contentDir);
  mkdirSync(contentDir, { recursive: true });
  const slug = autoSlug(title);
  const filename = `${slug}.md`;
  const filePath = join(contentDir, filename);
  // Avoid overwrite by suffixing
  let finalPath = filePath;
  let counter = 1;
  while (existsSync(finalPath)) {
    finalPath = join(contentDir, `${slug}-${counter}.md`);
    counter += 1;
  }
  const date = new Date().toISOString().slice(0, 10);
  const frontmatter: Record<string, unknown> = {
    title,
    slug,
    date,
    categories: categories.length > 0 ? categories : undefined,
    draft,
  };
  // Remove undefined
  for (const k of Object.keys(frontmatter)) {
    if (frontmatter[k] === undefined) delete frontmatter[k];
  }
  const content = matter.stringify(`\nWrite your content here.\n`, frontmatter);
  writeFileSync(finalPath, content, "utf8");
  return relative(projectRoot, finalPath).replace(/\\/g, "/");
}

export function renamePost(
  projectRoot: string,
  config: ProjectConfig,
  query: string,
  newName: string,
  alsoSlug: boolean,
): { from: string; to: string } | null {
  const found = findPostByQuery(projectRoot, config, query);
  if (found === null) return null;
  const dir = dirname(found);
  const ext = extname(found);
  const newFilename = newName.endsWith(ext) ? newName : `${newName}${ext}`;
  const dest = join(dir, newFilename);
  const raw = readFileSync(found, "utf8");
  let newRaw = raw;
  if (alsoSlug) {
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;
    data.slug = autoSlug(newName.replace(ext, ""));
    newRaw = matter.stringify(parsed.content, data);
    writeFileSync(found, newRaw, "utf8");
  }
  renameSync(found, dest);
  return {
    from: relative(projectRoot, found).replace(/\\/g, "/"),
    to: relative(projectRoot, dest).replace(/\\/g, "/"),
  };
}

export function movePost(
  projectRoot: string,
  config: ProjectConfig,
  query: string,
  destDir: string,
): { from: string; to: string } | null {
  const found = findPostByQuery(projectRoot, config, query);
  if (found === null) return null;
  const contentDir = join(projectRoot, config.contentDir);
  const dest = join(contentDir, destDir, basename(found));
  mkdirSync(dirname(dest), { recursive: true });
  renameSync(found, dest);
  return {
    from: relative(projectRoot, found).replace(/\\/g, "/"),
    to: relative(projectRoot, dest).replace(/\\/g, "/"),
  };
}
