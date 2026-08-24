# SPEC-API：@hyacine/api（Cloudflare Worker，Hono）

> 供施工 worker 阅读。契约唯一真相：`packages/contract`（本仓库 main 分支已含，你的 worktree 中已有）。
> 一切请求/响应形状以 `packages/contract/src/**` 的 zod schema 为准，**不得自创形状**。

## 目标

实现 API 包：Hono + Cloudflare Workers（workerd），原生绑定 D1/KV/R2，本地 `wrangler dev`（miniflare 模拟）可跑、可 curl、可测。验收后并入 main 由主编做端到端联调。

## 硬约束（/grilling 已定，不得突破）

- **单租户自托管**：无 tenants/users 表。
- **文件/git 是真源，D1 是派生索引**：API 不接收、不存储正文，只存索引 + AI 产物。
- **BYOK**：AI 提供商密钥是部署级环境变量，落 secret，不进 D1 明文表。
- **Workers 只签名不碰字节**：R2 上传走 S3 SigV4 presigned URL，Worker 不中转文件字节。
- **构建永远离线**：API 不做构建、不拉取 dist。
- 运行时是 **workerd**：禁止 node 内置模块（node:fs/crypto/path 一律禁止），用 Web Crypto（`crypto.subtle`）+ 全局 fetch。

## 工程

- 目录 `packages/api`，包名 `@hyacine/api`，`"private": true`，`"type": "module"`。
- 开发依赖：hono、@cloudflare/workers-types、wrangler、typescript、vitest、aws4fetch、@types/node。
- `wrangler.toml`：
  - `main = "src/index.ts"`
  - `[[d1_databases]] binding = "DB" database_name = "hyacine" database_id = "local"`（本地 miniflare 直接可用；远程部署时用户替换 real id）
  - `[[kv_namespaces]] binding = "CACHE" id = "local"`
  - `[[r2_buckets]] binding = "ASSETS" bucket_name = "hyacine-assets"`
  - `[ai] binding = "AI"`（Workers AI，本地开发在 test/smoke 中 mock）
  - `compatibility_date` 用当周值，`compatibility_flags` 不需要额外。
- `wrangler.jsonc` 不需要，保持 toml 单配置。
- `scripts`：`typecheck`（tsc --noEmit）、`test`（vitest run）、`dev`（wrangler dev --port 8787 --local）、`smoke`（node scripts/smoke.mjs）、`migrate:local`（wrangler d1 migrations apply DB --local）、`migrate:remote`（--remote）。
- tsconfig：extends 根 base；`"compilerOptions": { "types": ["@cloudflare/workers-types"], "lib": ["ESNext"] }`。若 contract 源码在 api 内 type-check 出现 fetch/Response 冲突，可把 `"DOM"` 加进 lib（与 workers-types 共存时以实际报错为准，能过就不加）。
- D1 迁移：`migrations/0001_init.sql`（纯 SQL，wrangler d1 migrations 管理）。

## D1 Schema（0001_init.sql）

```sql
CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  draft INTEGER NOT NULL DEFAULT 0,      -- 0/1
  categories TEXT NOT NULL DEFAULT '[]', -- JSON 数组
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL,              -- ISO8601
  updated_at TEXT NOT NULL,
  last_modified TEXT NOT NULL
);
CREATE TABLE ai_results (
  hash TEXT PRIMARY KEY,
  summary TEXT,
  summary_model TEXT,
  summary_at TEXT,
  embed_model TEXT,
  embed_dim INTEGER,
  embed_at TEXT,
  embed_vec TEXT,                        -- JSON 数组（mean 池化后的文档向量），NULL=未嵌入
  embed_chunks INTEGER
);
CREATE TABLE assets (
  path TEXT PRIMARY KEY,
  is_remote INTEGER NOT NULL DEFAULT 0,
  asset_type TEXT NOT NULL,
  file_type TEXT NOT NULL,
  r2_key TEXT,
  checksum TEXT,
  size INTEGER,
  updated_at TEXT NOT NULL
);
CREATE TABLE api_tokens (
  token_hash TEXT PRIMARY KEY,           -- sha256(token) hex
  label TEXT NOT NULL,
  scopes TEXT NOT NULL,                  -- JSON 数组
  expires_at TEXT,
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  post_count INTEGER NOT NULL,
  changed INTEGER NOT NULL,
  deleted INTEGER NOT NULL
);
```

## 环境变量（.dev.vars.example 列出全部；远程部署为 secrets）

| 变量 | 用途 |
|---|---|
| `SETUP_CODE` | setup 一次性 code（≥8 字符），admin token 签发凭证 |
| `AI_SUMMARY_ENDPOINT` | OpenAI 兼容 chat completions URL（BYOK） |
| `AI_SUMMARY_KEY` | 用户自持 key |
| `AI_SUMMARY_MODEL` | 模型名 |
| `R2_S3_ENDPOINT` | `https://<account>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 S3 API 凭据（presign 用） |
| `R2_BUCKET` | R2 bucket 名 |
| `EMBED_MODEL` | 默认 `@cf/baai/bge-m3`（多语言，dim 1024）；换模型=旧向量作废（ai_results 按 model 区分） |

AI 配置探测 → health：`AI_SUMMARY_ENDPOINT && AI_SUMMARY_KEY && AI_SUMMARY_MODEL` 齐 = summary:true；`EMBED_MODEL` + AI binding = embed:true。

## 路由实现（必须与 contract client 一一对应）

认证：除 `GET /api/health`、`GET /api/auth/setup`、`POST /api/auth/setup` 外全部需要 Bearer；scope 门禁：`posts.r`（listTokens 之外）、`posts.w`（sync/assets 写）、`ai`（ai/*）、`admin`（tokens 管理）。403 `forbidden`。

| 方法+路径 | 行为 | scope |
|---|---|---|
| GET /api/health | 见上 | 公开 |
| GET /api/auth/setup | `{needsSetup}`（无 SETUP_CODE secret 时为 true） | 公开 |
| POST /api/auth/setup | 校验 code===SETUP_CODE（恒定时间比较）；签发 admin token（scopes 全四态）；存 sha256(token) 行；返回 token 明文一次 | 公开（code 即凭证） |
| POST /api/auth/tokens | 建子 token（label/scopes/expiresInDays 可空=永不过期） | admin |
| GET /api/auth/tokens | 列表（不返回 token 明文，只 id/label/scopes/expires/lastUsed/created/revoked） | admin |
| POST /api/auth/tokens/:id/revoke | 置 revoked=1，revoke 自身返回 ok | admin |
| POST /api/sync | 全量快照 diff：新/变更（hash 不同或无行）upsert；unchanged 跳过；deletedPaths 删行；assets upsert（is_remote=false 登记，remote 行存在才写）；写 sync_logs；返回 contract SyncUploadResponse，`ai.needs` 依据 ai_results 缺失情况 | posts.w |
| GET /api/sync/log | 最近 50 条 | posts.r |
| POST /api/ai/summary | BYOK：剥离 frontmatter（自己写 stripFrontmatter：首 `---\n...\n---` 块）→ 调 OpenAI 兼容端点（`/chat/completions`，messages system+user，max_tokens 取 env 或 200）；结果写 ai_results（hash 主键 upsert：summary/summary_model/summary_at）；**缓存命中**（同 hash 已有 summary 且模型相同）直接返回。端点失败 → 502 `ai_failed`（保留旧值；summary_error 不建列，失败不落库） | ai |
| POST /api/ai/embed | 调 `env.AI.run(EMBED_MODEL, { text: chunks })` → `{data:[{embedding:number[]}]}`；mean 池化为文档向量；写 ai_results（embed_* 列）；响应只回 {hash, model, dim, chunkCount}（不回向量） | ai |
| POST /api/ai/similar | 查 query hash 的 embed_vec；全表扫有向量的行（排除自身）cosine 排序 top-k；返回 items（path/slug/title/score，score∈[-1,1]）；无向量可达 → 404 `embedding_missing` | ai |
| POST /api/ai/status | 批量 hashes → 每行 summary/embed present+model+at | ai |
| POST /api/assets/presign | aws4fetch SigV4(PUT) 到 `${R2_S3_ENDPOINT}/${R2_BUCKET}/${key}`，过期 300s；返回 {key,url,method:'PUT',headers,expiresAt}；key 复用请求 key（R2 对象路径即 key，前缀可加 `remote/`） | posts.w |
| POST /api/assets/register | upsert assets 行（is_remote=true, r2_key, checksum?, size?） | posts.w |
| GET /api/stats | totals/byCategory（JSON 解析累加）/byMonth（created_at 前 7 字符）/assets(remote 计数) | posts.r |

错误信封统一 `{error:{code,message,details?}}`。code 建议：`unauthorized`(401) / `forbidden`(403) / `setup_required`(400) / `invalid_code`(401) / `validation_error`(400) / `not_found`(404) / `conflict`(409) / `ai_failed`(502) / `ai_not_configured`(503) / `embedding_failed`(502) / `embedding_missing`(404) / `payload_too_large`(413)。

KV（CACHE）用途：`ai:{hash}:{model}` 摘要缓存（TTL 7d，D1 为准，KV 只做加速）、`limiter:{ip}`（简单计数，v0 可省）。不要过度设计。

## 测试

- 首选 `@cloudflare/vitest-pool-workers`（官方，真实 miniflare D1/KV/R2）。**若版本对不上安装失败，降级**：纯 vitest(node env) + 手写 in-memory D1/KV mock + 用 `fetch mock` 桩 AI/OpenAI 端点，并**必保** smoke 脚本兜底真实集成。
- 测试范围：auth（setup/token/scope 门禁）、sync diff（新/变/删/unchanged + ai.needs）、summary 缓存命中与 BYOK 调用、embed 存储与相似度的 cosine 正确性（构造已知向量断言 top-k 顺序）、presign URL 形状（mock aws4fetch 或只测参数装配）、stats 聚合。
- `scripts/smoke.mjs`：spawn `wrangler dev --port 8787 --local`（.dev.vars 注入测试 setup code + 假 AI 端点本地 stub），poll /api/health → 走一遍 setup→sync→summary(打桩)→presign 的最小链路，退出码非 0 即失败。Windows 下 spawn 注意 kill 进程树。

## 交付清单

1. `packages/api/**`（src/、migrations/、wrangler.toml、.dev.vars.example、vitest 配置、tsconfig）
2. `scripts/smoke.mjs`
3. 全部验证通过：`pnpm install`、`tsc --noEmit`、`vitest run`、`oxlint`（根）、`oxfmt`（根）、smoke 通过
4. 提交信息规范，完工报告写明：实现摘要、测试数字、降级选择（如未用 vitest-pool-workers 说明原因）

## 禁止

- 不使用 drizzle/其他 ORM（纯 SQL prepared statements）。
- 不引入 node 内置模块。
- 不改 contract 包、不改根配置、不新建其他包。
- 不处理正文内容存储（正文永不入库）。
- 不做多租户/配额/计费。