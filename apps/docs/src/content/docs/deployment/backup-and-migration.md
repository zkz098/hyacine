---
title: 数据备份与迁移
description: 导出 Cloudflare D1 数据、Markdown 文件全量备份与跨平台迁移指南。
---

保证数据可移植性是 Hyacine 的核心原则，用户绝不会被任何单一云平台锁定。

---

## 1. 通过 CLI 一键打包备份

使用 `hyc backup` 命令将本地与云端拉取的文章统一打包：

```bash
# 执行本地快照打包
hyc backup --output ./backup-20260826.tar.gz
```

生成的压缩包包含所有 Markdown/MDX 文件、Frontmatter 元数据及关联的静态图片资产。

---

## 2. Cloudflare D1 数据库直接导出

利用 Wrangler 导出云端 D1 数据库的全量 SQL 转储文件：

```bash
cd packages/api

# 导出远程 D1 数据库为 SQL 文件
wrangler d1 export hyacine --remote --output=./d1-backup.sql
```

导出的 SQL 可以在本地 SQLite 或其他兼容 SQL 数据库中直接读取与恢复。
