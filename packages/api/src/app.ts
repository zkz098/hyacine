import { Hono } from "hono";
import { cors } from "hono/cors";
import { healthRoutes } from "./routes/health";
import { configRoutes } from "./routes/config";
import { authRoutes } from "./routes/auth";
import { syncRoutes } from "./routes/sync";
import { aiRoutes } from "./routes/ai";
import { assetsRoutes } from "./routes/assets";
import { remoteRoutes } from "./routes/remote";
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
      allowHeaders: ["Content-Type", "Authorization", "x-d1-bookmark", "X-D1-Bookmark"],
      exposeHeaders: ["x-d1-bookmark", "X-D1-Bookmark"],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    }),
  );

  app.use("*", async (c, next) => {
    const rawBookmark = c.req.header("x-d1-bookmark") ?? c.req.header("X-D1-Bookmark");
    const bookmark =
      rawBookmark !== undefined && rawBookmark.trim().length > 0
        ? rawBookmark.trim()
        : "first-unconstrained";

    if (c.env?.DB && typeof c.env.DB.withSession === "function") {
      const session = c.env.DB.withSession(bookmark);
      c.set("db", session);
    } else if (c.env?.DB) {
      c.set("db", c.env.DB);
    }

    await next();

    const session = c.get("db") as D1DatabaseSession | undefined;
    if (session && typeof session.getBookmark === "function") {
      const nextBookmark = session.getBookmark();
      if (nextBookmark !== null && nextBookmark !== undefined && nextBookmark.length > 0) {
        c.res.headers.set("x-d1-bookmark", nextBookmark);
      }
    }
  });

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
  remoteRoutes(app);
  postsRoutes(app);
  statsRoutes(app);

  return app;
}
