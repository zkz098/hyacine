import { z } from "zod";

export function errorBody(code: string, message: string, details?: unknown) {
  if (details === undefined) {
    return { error: { code, message } };
  }
  return { error: { code, message, details } };
}

/** zod v4 规范错误扁平化（替代已 deprecated 的 error.flatten()，返回形状一致） */
export function flattenZodError(error: z.ZodError<unknown>): unknown {
  return z.flattenError(error);
}
