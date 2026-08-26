import type { Context } from "hono";
import type { Env, Variables } from "../types";

export type DatabaseClient = D1DatabaseSession | D1Database;

/**
 * 从 Hono 上下文中获取数据库实例：
 * - 若请求已初始化 D1 会话（D1DatabaseSession），返回该会话以确保会话级顺序一致性与只读副本调度
 * - 若未初始化会话，则回退至原始 c.env.DB
 */
export function getDb(c: Context<{ Bindings: Env; Variables: Variables }>): DatabaseClient {
  const session = c.get("db");
  if (session !== undefined && session !== null) {
    return session;
  }
  return c.env.DB;
}
