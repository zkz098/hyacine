// oxlint-disable eslint/no-await-in-loop
import { Hono } from "hono";
import { SyncUploadRequestSchema } from "@hyacine/contract";
import { errorBody } from "../utils/errors";
import { authMiddleware } from "../middleware/auth";
import type { Env, Variables } from "../types";

export function syncRoutes(app: Hono<{ Bindings: Env; Variables: Variables }>): void {
  app.post("/api/sync", authMiddleware(["posts.w"]), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = SyncUploadRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorBody("validation_error", "参数错误", parsed.error.flatten()), 400);
    }

    const input = parsed.data;

    // Load existing posts
    const existingResult = await c.env.DB.prepare("SELECT path, hash FROM posts").all<{
      path: string;
      hash: string;
    }>();
    const existingMap = new Map<string, string>();
    for (const row of existingResult.results ?? []) {
      existingMap.set(row.path, row.hash);
    }

    const changedHashes: string[] = [];
    const unchangedHashes: string[] = [];
    const inputPaths = new Set<string>();

    for (const post of input.posts) {
      inputPaths.add(post.path);
      const existingHash = existingMap.get(post.path);
      if (existingHash === undefined || existingHash !== post.hash) {
        changedHashes.push(post.hash);
        await c.env.DB.prepare(
          "INSERT INTO posts (path, slug, title, draft, categories, hash, created_at, updated_at, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(path) DO UPDATE SET slug=excluded.slug, title=excluded.title, draft=excluded.draft, categories=excluded.categories, hash=excluded.hash, updated_at=excluded.updated_at, last_modified=excluded.last_modified",
        )
          .bind(
            post.path,
            post.slug,
            post.title,
            post.draft ? 1 : 0,
            JSON.stringify(post.categories),
            post.hash,
            post.createdAt,
            post.updatedAt,
            post.lastModified,
          )
          .run();
      } else {
        unchangedHashes.push(post.hash);
      }
    }

    // Deleted paths
    const deletedPaths: string[] = [];
    for (const deleted of input.deletedPaths) {
      if (existingMap.has(deleted) && !inputPaths.has(deleted)) {
        deletedPaths.push(deleted);
      }
    }
    for (const deleted of deletedPaths) {
      await c.env.DB.prepare("DELETE FROM posts WHERE path = ?").bind(deleted).run();
      // also clean ai_results
      // we need hash for that post before deletion — we have it in existingMap
      const hash = existingMap.get(deleted);
      if (hash !== undefined) {
        await c.env.DB.prepare("DELETE FROM ai_results WHERE hash = ?").bind(hash).run();
      }
    }

    // Assets upsert (is_remote=false entries just登记)
    for (const asset of input.assets) {
      await c.env.DB.prepare(
        "INSERT INTO assets (path, is_remote, asset_type, file_type, r2_key, checksum, size, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(path) DO UPDATE SET is_remote=excluded.is_remote, asset_type=excluded.asset_type, file_type=excluded.file_type, r2_key=excluded.r2_key, checksum=excluded.checksum, size=excluded.size, updated_at=excluded.updated_at",
      )
        .bind(
          asset.path,
          asset.isRemote ? 1 : 0,
          asset.assetType,
          asset.fileType,
          asset.r2Key ?? null,
          asset.checksum ?? null,
          asset.size ?? null,
          asset.updatedAt,
        )
        .run();
    }

    // Sync logs
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      "INSERT INTO sync_logs (at, post_count, changed, deleted) VALUES (?, ?, ?, ?)",
    )
      .bind(now, input.posts.length, changedHashes.length, deletedPaths.length)
      .run();

    // AI needs: for each changed hash check ai_results
    const needs: { hash: string; path: string; reason: "summary" | "embed" | "both" }[] = [];
    // Build path map for quick lookup
    const hashToPath = new Map<string, string>();
    for (const post of input.posts) {
      hashToPath.set(post.hash, post.path);
    }

    for (const hash of changedHashes) {
      const row = await c.env.DB.prepare("SELECT summary, embed_vec FROM ai_results WHERE hash = ?")
        .bind(hash)
        .first<{ summary: string | null; embed_vec: string | null }>();
      const hasSummary =
        row !== null && row !== undefined && row.summary !== null && row.summary.length > 0;
      const hasEmbed =
        row !== null && row !== undefined && row.embed_vec !== null && row.embed_vec.length > 0;
      if (!hasSummary && !hasEmbed) {
        const path = hashToPath.get(hash) ?? "";
        needs.push({ hash, path, reason: "both" });
      } else if (!hasSummary) {
        const path = hashToPath.get(hash) ?? "";
        needs.push({ hash, path, reason: "summary" });
      } else if (!hasEmbed) {
        const path = hashToPath.get(hash) ?? "";
        needs.push({ hash, path, reason: "embed" });
      }
    }

    return c.json({
      accepted: { posts: input.posts.length, assets: input.assets.length },
      changedHashes,
      unchangedHashes,
      deletedPaths,
      ai: { needs },
    });
  });

  app.get("/api/sync/log", authMiddleware(["posts.r"]), async (c) => {
    const result = await c.env.DB.prepare(
      "SELECT at, post_count, changed, deleted FROM sync_logs ORDER BY at DESC LIMIT 50",
    ).all<{
      at: string;
      post_count: number;
      changed: number;
      deleted: number;
    }>();
    const entries = (result.results ?? []).map((row) => ({
      at: row.at,
      postCount: row.post_count,
      changed: row.changed,
      deleted: row.deleted,
    }));
    return c.json({ entries });
  });
}
