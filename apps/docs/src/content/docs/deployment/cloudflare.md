---
title: Cloudflare 全家桶部署
description: 详细指导如何部署 Hyacine API Worker 到 Cloudflare，并绑定 D1、KV、R2 与 Workers AI。
---

Hyacine 云端 API 是基于 **Hono** 框架构建的 Cloudflare Worker，充分利用 Cloudflare 边缘计算与无服务器存储。

---

## 1. 架构与绑定关系

| 绑定名称 (Binding) | Cloudflare 资源类型 | 用途说明                             | 必要性               |
| :----------------- | :------------------ | :----------------------------------- | :------------------- |
| `DB`               | **D1 Database**     | 存储文章元数据、内容、向量与操作日志 | **必须**             |
| `CACHE`            | **KV Namespace**    | AI 摘要计算缓存与短期限流计数器      | **必须**             |
| `AI`               | **Workers AI**      | 执行 BGE-M3 嵌入计算与文本摘要生成   | **必须** (或配 BYOK) |
| `ASSETS`           | **R2 Bucket**       | 博客静态图片与多媒体对象存储         | _可选_               |

---

## 2. 资源创建与绑定方案

### 推荐方案：自动预置 (Wrangler ≥ 4.45)

在 `packages/api/wrangler.toml` 中仅保留 binding 名称：

```toml title="packages/api/wrangler.toml"
name = "hyacine-api"
main = "src/index.ts"
compatibility_date = "2026-08-26"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"

[[kv_namespaces]]
binding = "CACHE"

[ai]
binding = "AI"

# 可选 R2 资产存储
# [[r2_buckets]]
# binding = "ASSETS"
```

执行部署时，Wrangler 会自动在云端创建对应资源并回写 ID：

```bash
cd packages/api
pnpm wrangler deploy
```

---

## 3. 配置核心 Secrets

部署完成后，需设置系统核心安全秘钥：

```bash
# 1. 设置系统初始化安装码 (首次进入控制台时鉴权使用，≥8位强随机字符)
wrangler secret put SETUP_CODE

# 2. (可选) 配置 BYOK OpenAI 兼容大模型 API 密钥
wrangler secret put OPENAI_API_KEY
```

---

## 4. 初始化 D1 数据表结构

Worker 首次部署后，执行数据迁移脚本建立数据表：

```bash
# 本地测试环境迁移
pnpm wrangler d1 migrations apply DB --local

# 云端生产环境迁移
pnpm wrangler d1 migrations apply DB --remote
```
