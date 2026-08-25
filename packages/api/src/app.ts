import { Hono } from "hono";
import { cors } from "hono/cors";
import { healthRoutes } from "./routes/health";
import { configRoutes } from "./routes/config";
import { authRoutes } from "./routes/auth";
import { syncRoutes } from "./routes/sync";
import { aiRoutes } from "./routes/ai";
import { assetsRoutes } from "./routes/assets";
import { statsRoutes } from "./routes/stats";
import { postsRoutes } from "./routes/posts";
import { errorBody } from "./utils/errors";
import type { Env, Variables } from "./types";

export function createApp(): Hono<{ Bindings: Env; Variables: Variables }> {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();

  app.use(
    "*",
    cors({
      origin: "*",
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    }),
  );

  app.onError((error, c) => {
    // zod validation etc should be handled per-route, here catch unexpected
    return c.json(errorBody("internal_error", String(error)), 500);
  });

  app.notFound((c) => c.json(errorBody("not_found", "未找到"), 404));

  healthRoutes(app);
  configRoutes(app);
  authRoutes(app);
  syncRoutes(app);
  aiRoutes(app);
  assetsRoutes(app);
  postsRoutes(app);
  statsRoutes(app);

  return app;
}
