import type { Context } from "hono";

/**
 * 后台任务：Workers 下用 `executionCtx.waitUntil`（保证响应返回后仍执行完）；
 * 非 Workers 环境（vitest 的 app.request() 不提供 executionCtx）时，
 * Hono 的 `c.executionCtx` getter 会直接 throw（HonoError: no ExecutionContext），
 * 这里捕获后仅防 unhandled rejection——避免线上 floating promise 被运行时
 * 静默丢弃，测试环境抛 500。
 */
export function defer(c: Context, promise: Promise<unknown>): void {
  try {
    c.executionCtx.waitUntil(promise);
  } catch {
    void promise.catch(() => {
      // ignore
    });
  }
}