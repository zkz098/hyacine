import { Hono } from "hono";
import { SyncUploadRequestSchema } from "@hyacine/contract";
import { errorBody, flattenZodError } from "../utils/errors";
import { authMiddleware } from "../middleware/auth";
import { defer } from "../utils/defer";
import { invalidateConfigCache, loadEffectiveConfig } from "../utils/config";
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
    const cfg = await loadEffectiveConfig(c.env);

    // 防线 1：项目身份校验 (Project Handshake)
    const boundProject = cfg.sync.boundProjectId.trim();
    const incomingProject = (input.projectId ?? "").trim();

    if (incomingProject.length > 0) {
      if (boundProject.length > 0 && boundProject !== incomingProject) {
        const isRebindRequested = input.rebindProject === true || input.force === true;
        if (!isRebindRequested) {
          return c.json(
            errorBody(
              "PROJECT_MISMATCH",
              `项目身份不匹配：当前远程端已绑定项目 [${boundProject}]，而请求来自 [${incomingProject}]。已阻止同步以防止数据被覆盖。若确定需要迁移或覆盖，请使用 --force / --rebind-project 并附带 admin 令牌。`,
              { boundProjectId: boundProject, incomingProjectId: incomingProject },
            ),
            409,
          );
        }
        // 强制重绑需要 admin 权限
        const scopes = c.get("scopes") ?? [];
        if (!scopes.includes("admin")) {
          return c.json(
            errorBody("forbidden", "强制重绑项目身份需要 admin 权限令牌"),
            403,
          );
        }
        // 记录新绑定
        await c.env.DB.prepare(
          "INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
        )
          .bind("sync.boundProjectId", incomingProject, new Date().toISOString())
          .run();
        await invalidateConfigCache(c.env);
      } else if (boundProject.length === 0) {
        // 首次同步自动绑定
        await c.env.DB.prepare(
          "INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
        )
          .bind("sync.boundProjectId", incomingProject, new Date().toISOString())
          .run();
        await invalidateConfigCache(c.env);
      }
    }

    // Load existing active posts (排除已软删除)
    const existingResult = await c.env.DB.prepare("SELECT path, hash, content FROM posts WHERE deleted_at IS NULL").all<{
      path: string;
      hash: string;
      content: string | null;
    }>();
    const existingMap = new Map<string, { hash: string; content: string | null }>();
    for (const row of existingResult.results ?? []) {
      existingMap.set(row.path, { hash: row.hash, content: row.content });
    }

    const inputPaths = new Set<string>();
    for (const post of input.posts) {
      inputPaths.add(post.path);
    }

    // 防线 2：大批量删除熔断 (Blast-Radius Fuse)
    const candidateDeleted: string[] = [];
    for (const deleted of input.deletedPaths) {
      if (existingMap.has(deleted) && !inputPaths.has(deleted)) {
        candidateDeleted.push(deleted);
      }
    }

    const totalExisting = existingMap.size;
    const deleteLimit = cfg.sync.maxDeleteLimit;
    const deleteRatio = cfg.sync.maxDeleteRatio;
    const deleteThreshold = Math.max(deleteLimit, Math.floor(totalExisting * deleteRatio));

    if (
      totalExisting > deleteLimit &&
      candidateDeleted.length > deleteThreshold &&
      input.allowBatchDelete !== true &&
      input.force !== true
    ) {
      return c.json(
        errorBody(
          "DELETION_THRESHOLD_EXCEEDED",
          `大批量删除熔断触发：本次请求试图删除 ${candidateDeleted.length} 篇文章（超过安全阈值 ${deleteThreshold} 篇）。已阻止删除操作以防止数据丢失。若确定需要批量删除，请附带 --allow-batch-delete 或在管理端确认。`,
          {
            attemptedDeleteCount: candidateDeleted.length,
            threshold: deleteThreshold,
            totalExisting,
          },
        ),
        422,
      );
    }

    const changedHashes: string[] = [];
    const unchangedHashes: string[] = [];
    const contentByHash = new Map<string, string>();

    for (const post of input.posts) {
      const existing = existingMap.get(post.path);
      const isContentChanged = existing === undefined || existing.hash !== post.hash;
      const content = post.content ?? null;

      await c.env.DB.prepare(
        "INSERT INTO posts (path, slug, title, draft, categories, hash, created_at, updated_at, last_modified, content, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL) ON CONFLICT(path) DO UPDATE SET slug=excluded.slug, title=excluded.title, draft=excluded.draft, categories=excluded.categories, hash=excluded.hash, updated_at=excluded.updated_at, last_modified=excluded.last_modified, content=coalesce(excluded.content, posts.content), deleted_at=NULL",
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

    // 防线 3：软删除标记 (保留 30 天回收与 ai_results 保护)
    for (const deleted of candidateDeleted) {
      await c.env.DB.prepare("UPDATE posts SET deleted_at = ? WHERE path = ?")
        .bind(new Date().toISOString(), deleted)
        .run();
    }

    // 自动清理超过 30 天的已软删除老数据
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    await c.env.DB.prepare("DELETE FROM posts WHERE deleted_at IS NOT NULL AND deleted_at < ?")
      .bind(thirtyDaysAgo)
      .run();

    const deletedPaths = candidateDeleted;

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
