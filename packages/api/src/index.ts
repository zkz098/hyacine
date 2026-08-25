import { createApp } from "./app";
import { processAiQueue } from "./utils/aiQueue";
import type { Env, Variables } from "./types";

const app = createApp();

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return Promise.resolve(app.fetch(request, env, ctx));
  },
  // P1: Cron 定期消费 AI 产物队列（wrangler.toml [triggers] crons）
  // 每 15 分钟 drain 常规任务；00:40 UTC 兜底处理被 3036 推迟到次日的任务
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(processAiQueue(env, 50));
  },
};

export type { Env, Variables };