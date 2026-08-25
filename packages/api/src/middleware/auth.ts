// oxlint-disable typescript/no-unsafe-type-assertion, typescript/consistent-return
import type { Context, Next } from "hono";
import { sha256Hex } from "../utils/crypto";
import { errorBody } from "../utils/errors";
import { defer } from "../utils/defer";
import type { Env, Variables } from "../types";

export function authMiddleware(requiredScopes: string[] = []) {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) => {
    const header = c.req.header("authorization") ?? c.req.header("Authorization");
    if (header === undefined || !header.startsWith("Bearer ")) {
      return c.json(errorBody("unauthorized", "缺少 Bearer token"), 401);
    }
    const token = header.slice("Bearer ".length).trim();
    if (token.length === 0) {
      return c.json(errorBody("unauthorized", "缺少 Bearer token"), 401);
    }
    const tokenHash = await sha256Hex(token);
    const row = await c.env.DB.prepare(
      "SELECT token_hash, label, scopes, expires_at, revoked FROM api_tokens WHERE token_hash = ?",
    )
      .bind(tokenHash)
      .first<{
        token_hash: string;
        label: string;
        scopes: string;
        expires_at: string | null;
        revoked: number;
      }>();

    if (row === null || row === undefined) {
      return c.json(errorBody("unauthorized", "token 无效"), 401);
    }
    if (row.revoked === 1) {
      return c.json(errorBody("unauthorized", "token 已撤销"), 401);
    }
    if (row.expires_at !== null) {
      const expires = Date.parse(row.expires_at);
      if (!Number.isNaN(expires) && Date.now() > expires) {
        return c.json(errorBody("unauthorized", "token 已过期"), 401);
      }
    }

    let scopes: string[];
    try {
      scopes = JSON.parse(row.scopes) as string[];
    } catch {
      scopes = [];
    }

    for (const required of requiredScopes) {
      if (!scopes.includes(required) && !scopes.includes("admin")) {
        return c.json(errorBody("forbidden", `缺少权限: ${required}`), 403);
      }
    }

    c.set("tokenId", tokenHash);
    c.set("scopes", scopes);
    c.set("label", row.label);

    // 后台更新 last_used_at：必须 waitUntil，否则 Workers 可能在响应返回后
    // 冻结 isolate，floating promise 被静默丢弃（CF 明确要求 await/waitUntil）
    const now = new Date().toISOString();
    defer(
      c,
      c.env.DB.prepare("UPDATE api_tokens SET last_used_at = ? WHERE token_hash = ?")
        .bind(now, tokenHash)
        .run()
        .catch(() => {
          // ignore
        }),
    );

    await next();
    return;
  };
}
