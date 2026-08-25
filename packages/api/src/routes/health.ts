import { Hono } from "hono";
import type { Env, Variables } from "../types";

export function healthRoutes(app: Hono<{ Bindings: Env; Variables: Variables }>): void {
  app.get("/api/health", (c) => {
    const needsSetup = c.env.SETUP_CODE === undefined || c.env.SETUP_CODE.length === 0;
    const hasSummary =
      c.env.AI_SUMMARY_ENDPOINT !== undefined &&
      c.env.AI_SUMMARY_ENDPOINT.length > 0 &&
      c.env.AI_SUMMARY_KEY !== undefined &&
      c.env.AI_SUMMARY_KEY.length > 0 &&
      c.env.AI_SUMMARY_MODEL !== undefined &&
      c.env.AI_SUMMARY_MODEL.length > 0;
    // embed 实际依赖 AI binding（routes/ai.ts 里 env.AI === undefined → 503），
    // 只查 EMBED_MODEL 会误报；运行时未绑定 AI 时 env.AI 为 undefined
    const hasEmbed = c.env.AI !== undefined && (c.env.EMBED_MODEL ?? "").length > 0;

    return c.json({
      ok: true as const,
      version: "0.1.0",
      needsSetup,
      ai: { summary: hasSummary, embed: hasEmbed },
    });
  });
}
