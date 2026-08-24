import { HyacineApiError } from "@hyacine/contract";

const codeMap: Record<string, string> = {
  unauthorized: "登录已失效，请重新登录",
  network_error: "无法连接 API",
  ai_failed: "AI 服务错误",
  embedding_missing: "嵌入不存在",
  forbidden: "权限不足",
  not_found: "未找到",
};

export function messageOf(err: unknown): string {
  if (err instanceof HyacineApiError) {
    const mapped = codeMap[err.code];
    if (mapped !== undefined) return mapped;
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
