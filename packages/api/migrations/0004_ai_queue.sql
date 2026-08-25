-- 0004_ai_queue.sql
-- AI 产物自动队列：sync 上行后按 autogen 开关入队，cron/内联消费；
-- 3036(Workers AI 日额度耗尽) → waiting 次日重试；3040(瞬时无容量) → 短退避
CREATE TABLE IF NOT EXISTS ai_queue (
  hash TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  kind TEXT NOT NULL,               -- 'summary' | 'embed' | 'both'
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_run_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);