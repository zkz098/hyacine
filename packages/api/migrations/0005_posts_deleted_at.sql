-- 0005_posts_deleted_at.sql
-- 软删除支持：记录删除时间，用于 30 天回收与防误删
ALTER TABLE posts ADD COLUMN deleted_at TEXT DEFAULT NULL;

