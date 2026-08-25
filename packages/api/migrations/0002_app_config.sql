-- 0002_app_config.sql
-- 服务级动态配置：env 为默认值，此处覆盖；管理台可读写，改动即时生效（无需 redeploy）
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);