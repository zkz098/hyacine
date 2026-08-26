// oxlint-disable typescript/no-unsafe-type-assertion, unicorn/no-array-sort
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { getDb } from "../utils/db";
import type { Env, Variables } from "../types";

export function statsRoutes(app: Hono<{ Bindings: Env; Variables: Variables }>): void {
  app.get("/api/stats", authMiddleware(["posts.r"]), async (c) => {
    const db = getDb(c);
    const postsResult = await db.prepare("SELECT draft, categories, created_at FROM posts").all<{
      draft: number;
      categories: string;
      created_at: string;
    }>();

    const allPosts = postsResult.results ?? [];
    const total = allPosts.length;
    const drafts = allPosts.filter((post) => post.draft === 1).length;
    const published = total - drafts;

    const byCategory: Record<string, number> = {};
    for (const post of allPosts) {
      try {
        const categories = JSON.parse(post.categories) as string[];
        for (const category of categories) {
          byCategory[category] = (byCategory[category] ?? 0) + 1;
        }
      } catch {
        // ignore
      }
    }

    const byMonthMap = new Map<string, number>();
    for (const post of allPosts) {
      const month = post.created_at.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(month)) {
        byMonthMap.set(month, (byMonthMap.get(month) ?? 0) + 1);
      }
    }
    const byMonth = [...byMonthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count }));

    const assetsResult = await db.prepare("SELECT is_remote FROM assets").all<{
      is_remote: number;
    }>();
    const assetsRows = assetsResult.results ?? [];
    const assets = {
      total: assetsRows.length,
      remote: assetsRows.filter((row) => row.is_remote === 1).length,
    };

    return c.json({
      totals: { posts: total, drafts, published },
      byCategory,
      byMonth,
      assets,
    });
  });
}
