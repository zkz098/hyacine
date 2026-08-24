// oxlint-disable typescript/no-unsafe-type-assertion
import { Hono } from "hono";
import { SetupRequestSchema, TokenCreateRequestSchema } from "@hyacine/contract";
import { generateToken, sha256Hex, timingSafeEqual } from "../utils/crypto";
import { errorBody } from "../utils/errors";
import { authMiddleware } from "../middleware/auth";
import type { Env, Variables } from "../types";

export function authRoutes(app: Hono<{ Bindings: Env; Variables: Variables }>): void {
  app.get("/api/auth/setup", (c) => {
    const needsSetup = c.env.SETUP_CODE === undefined || c.env.SETUP_CODE.length === 0;
    return c.json({ needsSetup });
  });

  app.post("/api/auth/setup", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = SetupRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorBody("validation_error", "参数错误", parsed.error.flatten()), 400);
    }

    const envCode = c.env.SETUP_CODE;
    if (envCode === undefined || envCode.length === 0) {
      return c.json(errorBody("setup_required", "未配置 SETUP_CODE"), 400);
    }

    if (!timingSafeEqual(parsed.data.code, envCode)) {
      return c.json(errorBody("invalid_code", "setup code 无效"), 401);
    }

    const token = generateToken();
    const tokenHash = await sha256Hex(token);
    const now = new Date().toISOString();
    const label = parsed.data.label ?? "admin";
    const scopes = JSON.stringify(["posts.r", "posts.w", "ai", "admin"]);

    await c.env.DB.prepare(
      "INSERT INTO api_tokens (token_hash, label, scopes, expires_at, last_used_at, created_at, revoked) VALUES (?, ?, ?, ?, ?, ?, 0)",
    )
      .bind(tokenHash, label, scopes, null, null, now)
      .run();

    return c.json({
      token,
      tokenId: tokenHash.slice(0, 16),
      label,
      scopes: ["posts.r", "posts.w", "ai", "admin"],
      expiresAt: null,
    });
  });

  app.post("/api/auth/tokens", authMiddleware(["admin"]), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = TokenCreateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(errorBody("validation_error", "参数错误", parsed.error.flatten()), 400);
    }

    const token = generateToken();
    const tokenHash = await sha256Hex(token);
    const now = new Date().toISOString();
    let expiresAt: string | null = null;
    if (parsed.data.expiresInDays !== undefined && parsed.data.expiresInDays !== null) {
      const date = new Date();
      date.setDate(date.getDate() + parsed.data.expiresInDays);
      expiresAt = date.toISOString();
    }
    const scopes = JSON.stringify(parsed.data.scopes);

    await c.env.DB.prepare(
      "INSERT INTO api_tokens (token_hash, label, scopes, expires_at, last_used_at, created_at, revoked) VALUES (?, ?, ?, ?, ?, ?, 0)",
    )
      .bind(tokenHash, parsed.data.label, scopes, expiresAt, null, now)
      .run();

    return c.json({
      token,
      tokenId: tokenHash.slice(0, 16),
      label: parsed.data.label,
      scopes: parsed.data.scopes,
      expiresAt,
    });
  });

  app.get("/api/auth/tokens", authMiddleware(["admin"]), async (c) => {
    const result = await c.env.DB.prepare(
      "SELECT token_hash, label, scopes, expires_at, last_used_at, created_at, revoked FROM api_tokens ORDER BY created_at DESC",
    ).all<{
      token_hash: string;
      label: string;
      scopes: string;
      expires_at: string | null;
      last_used_at: string | null;
      created_at: string;
      revoked: number;
    }>();

    const tokens = (result.results ?? []).map((row) => {
      let scopes: string[];
      try {
        scopes = JSON.parse(row.scopes) as string[];
      } catch {
        scopes = [];
      }
      return {
        id: row.token_hash.slice(0, 16),
        label: row.label,
        scopes,
        expiresAt: row.expires_at,
        lastUsedAt: row.last_used_at,
        createdAt: row.created_at,
        revoked: row.revoked === 1,
      };
    });

    return c.json({ tokens });
  });

  app.post("/api/auth/tokens/:id/revoke", authMiddleware(["admin"]), async (c) => {
    const id = c.req.param("id") ?? "";
    if (id.length === 0) {
      return c.json(errorBody("validation_error", "缺少 id"), 400);
    }
    // Find full hash by prefix
    const all = await c.env.DB.prepare("SELECT token_hash FROM api_tokens").all<{
      token_hash: string;
    }>();
    const matched = (all.results ?? []).find((row) => row.token_hash.startsWith(id));
    if (matched === undefined) {
      return c.json(errorBody("not_found", "token 不存在"), 404);
    }
    await c.env.DB.prepare("UPDATE api_tokens SET revoked = 1 WHERE token_hash = ?")
      .bind(matched.token_hash)
      .run();
    return c.json({ id, revoked: true });
  });
}
