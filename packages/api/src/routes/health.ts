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
    const hasEmbed = c.env.EMBED_MODEL !== undefined && c.env.EMBED_MODEL.length > 0;

    return c.json({
      ok: true as const,
      version: "0.1.0",
      needsSetup,
      ai: { summary: hasSummary, embed: hasEmbed },
    });
  });
}
