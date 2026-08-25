-- 0003_posts_content.sql
-- 正文落 D1：同步携带 content 时存储，解锁服务端自动 AI 产物与 Primary 远程编辑/导出
ALTER TABLE posts ADD COLUMN content TEXT;