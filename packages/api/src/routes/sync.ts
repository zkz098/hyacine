// oxlint-disable eslint/no-await-in-loop
import { Hono } from "hono";
import { SyncUploadRequestSchema } from "@hyacine/contract";
import { errorBody, flattenZodError } from "../utils/errors";
import { authMiddleware } from "../middleware/auth";
import { defer } from "../utils/defer";
import { loadEffectiveConfig } from "../utils/config";
import { enqueueAiNeeds, processAiQueue } from "../utils/aiQueue";
import type { AiKind } from "../utils/aiQueue";
import type { Env, Variables } from "../types";

export function syncRoutes(app: Hono<{ Bindings: Env; Variables: Variables }>): void {
  app.post("/api/sync", authMiddleware(["posts.w"]), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = SyncUploadRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorBody("validation_error", "参数错误", flattenZodError(parsed.error)), 400);
    }

    const input = parsed.data;

    // Load existing posts（带 content：判断「hash 未变但正文缺失」的老数据补 content）
    const existingResult = await c.env.DB.prepare("SELECT path, hash, content FROM posts").all<{
      path: string;
      hash: string;
      content: string | null;
    }>();
    const existingMap = new Map<string, { hash: string; content: string | null }>();
    for (const row of existingResult.results ?? []) {
      existingMap.set(row.path, { hash: row.hash, content: row.content });
    }

    const changedHashes: string[] = [];
    const unchangedHashes: string[] = [];
    const inputPaths = new Set<string>();
    // P1: 追踪本次上行带正文的 hash（自动 AI 需要正文）
    const contentByHash = new Map<string, string>();

    for (const post of input.posts) {
      inputPaths.add(post.path);
      const existing = existingMap.get(post.path);
      const isContentChanged = existing === undefined || existing.hash !== post.hash;
      const content = post.content ?? null;

      await c.env.DB.prepare(
        "INSERT INTO posts (path, slug, title, draft, categories, hash, created_at, updated_at, last_modified, content) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(path) DO UPDATE SET slug=excluded.slug, title=excluded.title, draft=excluded.draft, categories=excluded.categories, hash=excluded.hash, updated_at=excluded.updated_at, last_modified=excluded.last_modified, content=coalesce(excluded.content, posts.content)",
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
          content,
        )
        .run();

      if (post.content !== undefined) contentByHash.set(post.hash, post.content);

      if (isContentChanged) {
        changedHashes.push(post.hash);
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
    // 仅当没有任何保留文章引用该 hash 时才清 ai_results，避免两篇同内容
    // (同 hash) 文章因删一篇而被误删另一篇的 AI 产物
    const keptHashes = new Set<string>();
    for (const [path, row] of existingMap) {
      if (!deletedPaths.includes(path)) keptHashes.add(row.hash);
    }
    for (const deleted of deletedPaths) {
      await c.env.DB.prepare("DELETE FROM posts WHERE path = ?").bind(deleted).run();
      const hash = existingMap.get(deleted)?.hash;
      if (hash !== undefined && !keptHashes.has(hash)) {
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

    // P1 自动 AI 产物：按 autogen 开关对新变更且本次带正文的 hash 入队，内联小额消费
    const cfg = await loadEffectiveConfig(c.env);
    const toEnqueue: { hash: string; path: string; reason: AiKind }[] = [];
    for (const need of needs) {
      if (!contentByHash.has(need.hash)) continue;
      const kinds: AiKind[] = [];
      if (cfg.aiSummary.autogen && (need.reason === "summary" || need.reason === "both")) {
        kinds.push("summary");
      }
      if (cfg.embedAutogen && (need.reason === "embed" || need.reason === "both")) {
        kinds.push("embed");
      }
      if (kinds.length > 0) {
        toEnqueue.push({
          hash: need.hash,
          path: need.path,
          reason: kinds.length === 2 ? ("both" as const) : kinds[0]!,
        });
      }
    }
    if (toEnqueue.length > 0) {
      await enqueueAiNeeds(c.env, toEnqueue);
      defer(c, processAiQueue(c.env, 3));
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
