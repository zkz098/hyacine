import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import type { Env, Variables } from "../types";
import type { PostListItem } from "@hyacine/contract";

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
}

function isPresent(value: string | null | undefined): value is string {
  return value !== null && value !== undefined;
}

function parseCategories(raw: string): string[] {
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) {
    return parsed.filter((x): x is string => typeof x === "string");
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
        present: isPresent(row.embed_model) && isPresent(row.embed_at),
        model: row.embed_model ?? null,
        at: row.embed_at ?? null,
      },
    },
  };
}

/** 只读查询：文章索引 + AI 产物状态（console 用，posts.r） */
export function postsRoutes(app: Hono<{ Bindings: Env; Variables: Variables }>): void {
  app.get("/api/posts", authMiddleware(["posts.r"]), async (c) => {
    const result = await c.env.DB.prepare(
      `SELECT p.path, p.slug, p.title, p.draft, p.categories, p.hash,
              p.created_at, p.updated_at, p.last_modified,
              a.summary, a.summary_model, a.summary_at,
              a.embed_model, a.embed_at
       FROM posts p
       LEFT JOIN ai_results a ON a.hash = p.hash
       ORDER BY datetime(p.updated_at) DESC`,
    ).all<PostJoinRow>();

    const posts = result.results.map((row) => toListItem(row));
    return c.json({ posts });
  });
}
