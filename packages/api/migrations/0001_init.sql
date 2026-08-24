-- 0001_init.sql
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  draft INTEGER NOT NULL DEFAULT 0,
  categories TEXT NOT NULL DEFAULT '[]',
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_modified TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_results (
  hash TEXT PRIMARY KEY,
  summary TEXT,
  summary_model TEXT,
  summary_at TEXT,
  embed_model TEXT,
  embed_dim INTEGER,
  embed_at TEXT,
  embed_vec TEXT,
  embed_chunks INTEGER
);
CREATE TABLE IF NOT EXISTS assets (
  path TEXT PRIMARY KEY,
  is_remote INTEGER NOT NULL DEFAULT 0,
  asset_type TEXT NOT NULL,
  file_type TEXT NOT NULL,
  r2_key TEXT,
  checksum TEXT,
  size INTEGER,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS api_tokens (
  token_hash TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  scopes TEXT NOT NULL,
  expires_at TEXT,
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  post_count INTEGER NOT NULL,
  changed INTEGER NOT NULL,
  deleted INTEGER NOT NULL
);
