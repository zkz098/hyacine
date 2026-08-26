import { Hono } from "hono";
import { loadEffectiveConfig } from "../utils/config";
import { getDb } from "../utils/db";
import type { Env, Variables } from "../types";

export function healthRoutes(app: Hono<{ Bindings: Env; Variables: Variables }>): void {
  app.get("/api/health", async (c) => {
    const db = getDb(c);
    const cfg = await loadEffectiveConfig(c.env, db);
    const needsSetup = (c.env.SETUP_CODE ?? "").length === 0;
    const hasSummary =
      cfg.aiSummary.provider === "workers-ai"
        ? c.env.AI !== undefined
        : cfg.aiSummary.endpoint.length > 0 &&
          cfg.aiSummary.key.length > 0 &&
          cfg.aiSummary.model.length > 0;
    // embed 依赖 AI binding（env.AI === undefined 判定）+ 配置的嵌入模型
    const hasEmbed = c.env.AI !== undefined && cfg.embedModel.length > 0;
    // Primary 模式可用性：github 桥配置齐全（D1↔git 双向才有落点）
    const primaryAvailable =
      cfg.github.repoOwner.length > 0 &&
      cfg.github.repoName.length > 0 &&
      cfg.github.token.length > 0;

    return c.json({
      ok: true as const,
      version: "0.1.0",
      needsSetup,
      mode: "gateway" as const,
      ai: { summary: hasSummary, embed: hasEmbed },
      gateway: {
        available: true,
      },
      primary: {
        available: primaryAvailable,
        repo: primaryAvailable ? `${cfg.github.repoOwner}/${cfg.github.repoName}` : null,
      },
    });
  });
}
