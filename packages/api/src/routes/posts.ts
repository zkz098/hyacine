import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { errorBody, flattenZodError } from "../utils/errors";
import type { Env, Variables } from "../types";
import { type PostListItem, PostDeleteRequestSchema } from "@hyacine/contract";

interface PostJoinRow {
  path: string;
  slug: string;
  title: string;
  draft: number;
  categories: string;
  hash: string;
  created_at: string;
  updated_at: string;
  last_modified: string;
  summary: string | null;
  summary_model: string | null;
  summary_at: string | null;
  embed_model: string | null;
  embed_at: string | null;
  embed_vec: string | null;
}

function isPresent(value: string | null | undefined): value is string {
  return value !== null && value !== undefined;
}

function parseCategories(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string");
    }
  } catch {
    // 脏数据（历史/手改）不炸列表
  }
  return [];
}

function toListItem(row: PostJoinRow): PostListItem {
  return {
    path: row.path,
    slug: row.slug,
    title: row.title,
    draft: row.draft === 1,
    categories: parseCategories(row.categories),
    hash: row.hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastModified: row.last_modified,
    ai: {
      summary: {
        present: isPresent(row.summary),
        model: row.summary_model ?? null,
        at: row.summary_at ?? null,
      },
      embed: {
        // 与 sync/ai-status 口径一致：以 embed_vec 是否有值判定（而不是 model/at）
        present: isPresent(row.embed_vec),
        model: row.embed_model ?? null,
        at: row.embed_at ?? null,
      },
    },
  };
}

/** 只读查询与删除：文章索引 + AI 产物状态（console 用）
 * 支持 ?prefix=<repo-相对目录> 按集合过滤（如 prefix=src/moments）。
 */
export function postsRoutes(app: Hono<{ Bindings: Env; Variables: Variables }>): void {
  app.get("/api/posts", authMiddleware(["posts.r"]), async (c) => {
    const prefix = (c.req.query("prefix") ?? "").trim().replace(/\\/g, "/").replace(/\/+$/, "");
    let sql = `SELECT p.path, p.slug, p.title, p.draft, p.categories, p.hash,
              p.created_at, p.updated_at, p.last_modified,
              a.summary, a.summary_model, a.summary_at,
              a.embed_model, a.embed_at, a.embed_vec
       FROM posts p
       LEFT JOIN ai_results a ON a.hash = p.hash
       WHERE p.deleted_at IS NULL`;
    const params: string[] = [];
    if (prefix.length > 0) {
      sql += ` AND (p.path = ? OR p.path LIKE ?)`;
      params.push(prefix, `${prefix}/%`);
    }
    sql += ` ORDER BY datetime(p.updated_at) DESC`;
    const result = await c.env.DB.prepare(sql)
      .bind(...params)
      .all<PostJoinRow>();

    const posts = result.results.map((row) => toListItem(row));
    return c.json({ posts });
  });

  app.delete("/api/posts", authMiddleware(["posts.w"]), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = PostDeleteRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorBody("validation_error", "参数错误", flattenZodError(parsed.error)), 400);
    }
    const { paths } = parsed.data;
    const now = new Date().toISOString();
    for (const path of paths) {
      await c.env.DB.prepare("UPDATE posts SET deleted_at = ? WHERE path = ?")
        .bind(now, path)
        .run();
    }
    return c.json({
      deletedCount: paths.length,
      deletedPaths: paths,
    });
  });
}
