// oxlint-disable typescript/no-unsafe-type-assertion, eslint/no-await-in-loop
import { Hono } from "hono";
import { PostUpsertRequestSchema } from "@hyacine/contract";
import { errorBody, flattenZodError } from "../utils/errors";
import { authMiddleware } from "../middleware/auth";
import { defer } from "../utils/defer";
import { loadEffectiveConfig } from "../utils/config";
import { postBodyHash } from "../utils/hash";
import { parseFrontmatterMeta } from "../utils/frontmatter";
import { triggerExportDispatch } from "../utils/github";
import { enqueueAiNeeds, processAiQueue } from "../utils/aiQueue";
import type { Env, Variables } from "../types";

function cleanSlugText(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-/, "")
    .replace(/-+$/, "");
}

/**
 * 本地轻量 slug：显式 slug 清洗（保留 Unicode）；缺失时用标题清洗兜底（不做拼音）。
 * 注意：不 import contract 的 slug.ts —— 其顶层加载 pinyin-pro，在 Workers 全局
 * 作用域会执行 setTimeout → 部署报 10021。Worker bundle 因此与 pinyin-pro 完全解耦。
 */
function resolveSlug(dataSlug: unknown, title: string): string {
  if (typeof dataSlug === "string") {
    const s = cleanSlugText(dataSlug);
    if (s.length > 0) return s;
  }
  const t = cleanSlugText(title);
  return t.length > 0 ? t : `post-${Date.now()}`;
}

/**
 * Primary 模式（双真相源）路由：
 * - POST /api/posts           远程编辑/import 保存（解析 frontmatter+hash，自动触发 git 导出）
 * - GET  /api/posts/content/* 远程读取正文（wildcard 支持子目录路径）
 * - GET  /api/export          D1 → git 全量快照（workflow export job 拉取）
 * - POST /api/export/trigger  触发 GitHub repository_dispatch（admin）
 */

export function remoteRoutes(app: Hono<{ Bindings: Env; Variables: Variables }>): void {
  app.post("/api/posts", authMiddleware(["posts.w"]), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = PostUpsertRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorBody("validation_error", "参数错误", flattenZodError(parsed.error)), 400);
    }
    const { path, content } = parsed.data;

    const [hash, meta] = await Promise.all([
      postBodyHash(content),
      Promise.resolve(parseFrontmatterMeta(content)),
    ]);
    const title =
      meta.title ??
      path
        .replace(/\.(md|mdx)$/, "")
        .split("/")
        .pop() ??
      path;
    // 本地轻量 slug（Worker 侧无拼音依赖，见文件头部注释）
    const slug = resolveSlug(meta.slug, title);

    const existing = await c.env.DB.prepare("SELECT hash, created_at FROM posts WHERE path = ?")
      .bind(path)
      .first<{ hash: string; created_at: string }>();
    const oldHash = existing?.hash ?? null;
    const changed = oldHash === null || oldHash !== hash;
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      "INSERT INTO posts (path, slug, title, draft, categories, hash, created_at, updated_at, last_modified, content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(path) DO UPDATE SET slug=excluded.slug, title=excluded.title, draft=excluded.draft, categories=excluded.categories, hash=excluded.hash, updated_at=excluded.updated_at, last_modified=excluded.last_modified, content=excluded.content",
    )
      .bind(
        path,
        slug,
        title,
        (meta.draft ?? false) ? 1 : 0,
        JSON.stringify(meta.categories ?? []),
        hash,
        existing?.created_at ?? now,
        now,
        now,
        content,
      )
      .run();

    // 正文变更 → 旧 AI 产物失效
    if (changed && oldHash !== null && oldHash !== hash) {
      await c.env.DB.prepare("DELETE FROM ai_results WHERE hash = ?").bind(oldHash).run();
    }

    // autogen 联动：正文变更且配置开启 → 入队 + 内联消费
    if (changed) {
      const cfg = await loadEffectiveConfig(c.env);
      const kinds: ("summary" | "embed" | "both")[] = [];
      if (cfg.aiSummary.autogen) kinds.push("summary");
      if (cfg.embedAutogen) kinds.push("embed");
      if (kinds.length > 0) {
        await enqueueAiNeeds(c.env, [
          { hash, path, reason: kinds.length === 2 ? "both" : (kinds[0] ?? "summary") },
        ]);
        defer(c, processAiQueue(c.env, 3));
      }
    }

    // Primary：保存后触发 GitHub 导出（失败不阻塞保存）
    let dispatched = false;
    try {
      const r = await triggerExportDispatch(c.env);
      dispatched = r.dispatched;
    } catch {
      dispatched = false;
    }

    return c.json({
      path,
      slug,
      title,
      draft: meta.draft ?? false,
      categories: meta.categories ?? [],
      hash,
      changed,
      dispatched,
    });
  });

  app.get("/api/posts/content", authMiddleware(["posts.r"]), async (c) => {
    const path = c.req.query("path") ?? "";
    if (path.length === 0) {
      return c.json(errorBody("validation_error", "缺少 path 参数"), 400);
    }
    const row = await c.env.DB.prepare("SELECT content FROM posts WHERE path = ?")
      .bind(path)
      .first<{ content: string | null }>();
    if (row === null || row === undefined || row.content === null) {
      return c.json(errorBody("not_found", "文章不存在"), 404);
    }
    return c.json({ path, content: row.content });
  });

  app.get("/api/export", authMiddleware(["posts.r"]), async (c) => {
    const result = await c.env.DB.prepare(
      "SELECT path, content FROM posts WHERE content IS NOT NULL AND content != '' ORDER BY path",
    ).all<{ path: string; content: string | null }>();
    const posts = (result.results ?? [])
      .filter((row) => row.content !== null)
      .map((row) => ({ path: row.path, content: row.content as string }));
    return c.json({ generatedAt: new Date().toISOString(), posts });
  });

  app.post("/api/export/trigger", authMiddleware(["admin"]), async (c) => {
    const r = await triggerExportDispatch(c.env);
    if (r.dispatched) return c.json(r);
    return c.json(r, r.error !== undefined ? 400 : 200);
  });
}
