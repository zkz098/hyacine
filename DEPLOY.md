# hyacine 部署文档

> 适用版本：hyacine 0.1.0（monorepo：`packages/{contract,api,cli}` + `apps/{console,desktop}`）
>
> 覆盖三部分：**Cloudflare Worker API（云端数据面）**、**CLI（本地内容管理/同步）**、**桌面应用（Tauri + 管理台）**。

---

## 1. 架构总览

```
┌─────────────────────┐      ┌──────────────────────────────┐
│ 本地（桌面 / CLI）    │ sync │  Cloudflare Worker (hyacine-api)│
│  - markdown/mdx 原文 │ ───► │  - D1  hyacine（索引/用量/日志）│
│  - presign 直传 R2*  │ ◄─── │  - KV  CACHE（AI 摘要缓存）      │
│  - git commit/push   │      │  - R2* hyacine-assets（图片等）  │
└─────────────────────┘      │  - Workers AI（嵌入 bge-m3）      │
        │ push                └──────────────────────────────┘
        ▼
 博客仓库（astro-blog-shokax）→ CI/构建 → 线上博客
```

- **云平面**：管理台/CLI 经 HTTP API 读索引、看 AI 状态、管理 token、统计。
- **本地平面（桌面离线）**：直接读写博客目录文件，不依赖 API。
- **内容流向**：本地编辑 → `sync` 全量上行（按 hash diff）→ 服务端返回 `ai.needs` → 按需跑 AI 摘要/嵌入 → 资产 presign 直传 R2（可选）→ 本地 `git push` 触发博客构建。
- \* **R2 为可选能力**：不配置 R2 凭据/绑定即可正常部署与使用，仅 `/api/assets/presign` 返回 503 `r2_not_configured`，其余接口不受影响。

---

## 2. 前置要求

| 组件 | 版本/说明 |
|---|---|
| Node.js | ≥ 22 |
| pnpm | ≥ 9（workspace） |
| wrangler | ≥ 3（`pnpm dlx wrangler` 或全局安装） |
| Cloudflare 账号 | 用于 D1/KV/R2/AI 绑定 |
| （桌面构建）Rust | stable toolchain + MSVC（Windows 见 §5.2） |
| （桌面构建）VS | Visual Studio 2026 Community（VC++ 工具集，Windows） |

安装依赖：

```bash
pnpm install
```

---

## 3. Cloudflare 侧部署（API）

### 3.1 创建云资源（三选一，**互相排斥**）

> ⚠️ **部署通道选一个，不要混用**：`wrangler deploy` 会以 wrangler.toml 为**权威**，覆盖 Worker 上同名的 Dashboard 绑定。因此若在 Bindings 页手加过 D1/KV，就**不要**再用 `wrangler deploy`（否则绑定被覆盖成无效值、部署失败）；仓库默认已去除 `id="local"` 占位，选方案 A 即可自动预置。`[ai]` 绑定已在配置内。

**方案 A — 自动预置（推荐，wrangler ≥ 4.45，open beta）**

把 wrangler.toml 里 D1/KV/R2 的 id/bucket 名**直接去掉**，只留 binding 名：

```toml
[[d1_databases]]
binding = "DB"
[[kv_namespaces]]
binding = "CACHE"
# [[r2_buckets]]   # 可选：不需要资产直传 R2 可省略
# binding = "ASSETS"
```

然后直接 `wrangler dev`（本地自动建本地资源）和 `wrangler deploy`——云端资源会以 binding 名自动创建，**id 自动回写进 wrangler.toml**（若从 GitHub/dashboard 部署，id 只存在 dashboard，不会回写仓库，用方案 B 查看）。

**方案 B — Dashboard「Bindings」页（可视化，不用 wrangler 部署）**

Workers & Pages → 选择 `hyacine-api` → **Bindings** 页：

- 可**添加/管理** D1（选 `hyacine` 库）、KV（`CACHE`）、R2（`hyacine-assets`）、Workers AI 等所有绑定，以及变量/Secret；
- 可视化查看 Worker 架构图，直接从界面增删绑定；
- **⚠️ 选了方案 B 就用 dashboard 的 `Edit code` / git 集成来发布代码，不要再执行 `wrangler deploy`**（会覆盖 dashboard 绑定）。本地 `wrangler dev --local` 仍可保留 wrangler.toml 里的 binding 定义用于模拟，但这与云端绑定无关。

**方案 C — wrangler CLI 手动（兜底/精确控制）**

```bash
cd packages/api

# 1) D1 数据库
wrangler d1 create hyacine
# → 输出 database_id，粘贴到 wrangler.toml 的 [[d1_databases]] database_id

# 2) KV 命名空间（AI 摘要缓存）
wrangler kv namespace create CACHE
# → 输出 id，粘贴到 [[kv_namespaces]] id

# 3) R2 桶（可选：不需要资产直传 R2 可跳过）
wrangler r2 bucket create hyacine-assets
```

### 3.2 配置 Secrets（CLI 或 Dashboard 二选一）

**方式 1 — wrangler CLI**

```bash
wrangler secret put SETUP_CODE            # 首次安装码，≥8 位强随机
wrangler secret put AI_SUMMARY_ENDPOINT   # OpenAI 兼容端点，如 https://api.openai.com/v1/chat/completions
wrangler secret put AI_SUMMARY_KEY        # 对应 API Key
# 以下 R2 凭据为可选（资产直传 R2 时才需要）：
wrangler secret put R2_S3_ENDPOINT        # https://<account_id>.r2.cloudflarestorage.com
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
```

非 secret 配置项也可用 `wrangler secret put`（或放 wrangler.toml）：

```bash
wrangler secret put AI_SUMMARY_MODEL      # 如 gpt-4o-mini
wrangler secret put R2_BUCKET             # hyacine-assets（可选）
wrangler secret put EMBED_MODEL           # 默认 @cf/baai/bge-m3
```

**方式 2 — Dashboard「Bindings」页**

Worker → Bindings → Add：可添加 **Secret** 与 **Environment variable**（值同上面清单），可视化查看/编辑，改完点 Deploy 生效。适合不常跑 wrangler 的维护。

> AI 摘要走 OpenAI 兼容端点（BYOK），不需要 Workers AI；**嵌入**依赖 `[ai]` 绑定（`@cf/baai/bge-m3`）。

### 3.3 建表（D1 迁移）

```bash
pnpm --filter @hyacine/api migrate:remote
# 等价于 wrangler d1 migrations apply DB --remote
```

> 也可在 Dashboard 的 **D1 → Console** 手动执行 `migrations/*.sql`（一次性建表可用，但**不写入 `d1_migrations` 版本表**，后续与 wrangler 迁移版本管理对不上）。

### 3.4 部署 Worker（一条龙：先迁移，再发布）

```bash
pnpm --filter @hyacine/api deploy
# = wrangler d1 migrations apply DB --remote && wrangler deploy
# （新迁移文件放 packages/api/migrations/，deploy 会自动先把表结构推上去再更新 Worker 代码）
```

验证：

```bash
curl https://<你的worker域名>/api/health
# → {"ok":true,"version":"0.1.0","needsSetup":false,"ai":{"summary":true,"embed":true}}
```

### 3.5 R2 bucket CORS（浏览器/桌面 presign 直传必需）

管理台（浏览器/WebView）会拿 presigned URL **直接从浏览器 PUT 到 R2**，桶必须放行 CORS。可用 CLI 或 Dashboard：

**CLI**：创建 `packages/api/cors.json`：

```json
{
  "AllowedOrigins": ["*"],
  "AllowedMethods": ["GET", "PUT", "HEAD"],
  "AllowedHeaders": ["content-type", "authorization", "x-amz-*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}
```

```bash
cd packages/api
wrangler r2 bucket cors set hyacine-assets --cors-file cors.json
```

**Dashboard**：R2 → `hyacine-assets` → Settings → CORS，按同样规则填写即可。

> presigned URL 已把 `content-type` 纳入签名，客户端上传必须带匹配的 Content-Type。

### 3.6 首次初始化（拿长期 token）

```bash
# 1) 检查是否待初始化
curl https://<worker>/api/auth/setup
# {"needsSetup":false}

# 2) 用 SETUP_CODE 换 admin token
curl -X POST https://<worker>/api/auth/setup \
  -H "content-type: application/json" \
  -d '{"code":"<SETUP_CODE>","label":"admin"}'
# → { token, tokenId, scopes:[posts.r,posts.w,ai,admin] }
```

- 该 token 存到管理台/桌面/CLI（见 §4、§5）。
- 可再创建受限子 token：`POST /api/auth/tokens`（需 admin），scope 为 `posts.r`/`posts.w`/`ai`。
- `/api/auth/setup` 带 KV 尝试限流（10 次/分/IP），失败后 1 分钟再试。

### 3.7 启用 AI：summary（摘要）与 embed（嵌入）

两者独立，`/api/health` 的 `ai.summary` / `ai.embed` 即对应是否就绪：

**summary（BYOK，不需要 Workers AI）**

- 三个环境项（`wrangler secret put` 或 Dashboard Bindings → 变量/Secret）：
  - `AI_SUMMARY_ENDPOINT`：OpenAI 兼容 chat completions URL，如 `https://api.openai.com/v1/chat/completions`
  - `AI_SUMMARY_KEY`：对应 API Key
  - `AI_SUMMARY_MODEL`：模型名，如 `gpt-4o-mini`
- 调用链：`/api/ai/summary` → `fetch(endpoint, Bearer key, 正文前 8000 字, max_tokens 200)` → 写 D1 + KV 缓存（`ai:{hash}:{model}`，7 天）
- 验证：health `ai.summary:true`；然后 `hyc ai:summary <query>` 或管理台 Editor「AI 摘要」按钮生成

**embed（依赖 Workers AI binding）**

- 需要：
  - `[ai]` binding：wrangler.toml 已含 `[ai] binding = "AI"`（方案 A 部署自动带；**方案 B** 需在 Dashboard Bindings 页加 Workers AI 绑定，且 binding 名必须为 `AI`）
  - `EMBED_MODEL`：默认回退 `@cf/baai/bge-m3`（1024 维、中文友好、免费档）；也可显式 `wrangler secret put EMBED_MODEL`
- 调用链：`/api/ai/embed` → `env.AI.run(model, { text })` 逐块嵌入 → mean 池化为文档向量 → D1 `embed_vec`
- ⚠️ **embed 只走 Workers AI（`env.AI.run`）**，目前没有 OpenAI 兼容 embedding 端点回退；不绑 Workers AI 则 `/api/ai/embed` 恒 503「Workers AI 未绑定」
- ⚠️ 换模型 = 旧向量作废（`ai_results` 按 `embed_model` 区分）；`ai/similar` 全表扫有向量行，不建议混模型
- 验证：health `ai.embed:true`；`hyc ai:embed` 生成（`hyc sync` 返回的 `ai.needs` 会提示缺哪些 hash 的 summary/embed）

### 3.9 自动 AI 产物（队列，P1）

开启「自动生成摘要/嵌入」后，**新/变更文章上行到 API 后自动入队生成**，无需手动 CLI：

- 开启：管理台 → 设置 → 云端配置：`AI 摘要 → 自动生成摘要`、`嵌入 → 自动生成嵌入`（对应 `aiSummary.autogen` / `embedAutogen`，改动即时生效）
- 前提：同步需携带正文（cli/桌面 `sync` 已默认带，P0 落 `posts.content`）；未带正文的文章不会自动入队
- 消费：sync 后 waitUntil 内联小额 + Cron（`*/15 * * * *` + `0 1 * * *`）
- **Workers AI 每日免费 10,000 neurons，00:00 UTC 重置**；错误分流：
  - `3036`（额度耗尽）→ 队列 `waiting`，**次日 00:40 UTC 再试**（当天不再碰）
  - `3040`（瞬时无容量）→ 5 分钟短退避重试
  - 其余错误重试 5 次后置 `failed`（可在管理台/DB 查看 `ai_queue` 行）
- 摘要提供方可选：`byok`（OpenAI 兼容端点，默认）或 `workers-ai`（`aiSummary.provider`，model 填 `@cf/...`，默认 `@cf/meta/llama-3.2-3b-instruct`）

> 队列表 `ai_queue` 由 migration 0004 创建，`pnpm --filter @hyacine/api deploy` 一条龙自动应用；`[triggers] crons` 已写入 wrangler.toml。

### 3.8 动态配置（管理台可视化管理，免 redeploy）

部署后除了 env/secret，还可以在**管理台 → 设置（登录后）**直接改 AI/R2 配置，即时生效：

- 存储：D1 `app_config` 表（migration 0002，`deploy` 一条龙已自动应用）
- 生效顺序：**env 默认值 → D1 覆盖**；读取带 KV 缓存（`app:config:v1`，60s TTL，写入即失效）
- 接口：`GET/PUT /api/admin/config`（**admin scope**）；敏感值（AI Key / R2 Secret）只回显 `{set:true}` 不回明文，PUT 时留空=保持不变、空串=清除（回退 env）
- 覆盖范围：`aiSummary.endpoint/key/model`、`embedModel`、`r2.endpoint/accessKeyId/secretAccessKey/bucket`（与 health/ai/assets 路由全部联动）
- 用 CLI 管理（等价）：

```bash
# 先用 admin token 换请求头（SETUP_CODE → /api/auth/setup）
curl -X PUT https://<worker>/api/admin/config \
  -H "authorization: Bearer <admin-token>" -H "content-type: application/json" \
  -d '{"embedModel":"@cf/baai/bge-m3","aiSummary":{"model":"gpt-4o-mini"}}'
```

---

### 3.10 Primary 模式：D1 与 Git 双真相源（远程编辑/远程配置）

默认 Replica 模式（本地 git 真相源 → 同步上行索引）。开启 Primary 后，D1 里的文章可直接远程编辑并**自动落回博客仓库 git**（触发线上构建）：

1. **配置 GitHub**：管理台 → 设置 → 云端配置 → `Primary（GitHub 桥）`：仓库 Owner / 仓库名 / PAT（需 `repo` scope，仅用于 repository_dispatch）。对应 `github.repoOwner/repoName/token`。
2. **安装桥 workflow**：把 `packages/api/workflows/hyacine-bridge.yml` 复制到博客仓库 `.github/workflows/`，并配 GitHub Actions Secrets：`HYACINE_API_URL`（Worker 地址）、`HYACINE_TOKEN`（带 posts.w/r 的 hyacine token）。
3. **远程编辑**：管理台 Posts 页 →「远程编辑」→ 改正文 → 保存 → API 解析 frontmatter/hash 落 D1（联动自动 AI）→ 自动 `repository_dispatch('hyacine:export')` → workflow 拉 `/api/export` 全量快照写文件 → `hyacine:sync` commit（`GITHUB_TOKEN` 提交不回环）→ push 触发博客构建。
4. **git → D1**：main 分支普通 push → workflow import job 收集集合目录下变更 `.md/.mdx` → `POST /api/posts` 上传 → API 解析落 D1。
5. **手动导出**：管理台 Sync 页「导出到 Git」→ `POST /api/export/trigger`。

> **冲突语义**：双真相源 = 最后写入者胜（`updated_at`/提交时间）。**避免两端同时编辑同一文件**；导出为全量覆盖（`git add -A` 提交，已删文章随之移除）。

### 3.11 多内容集合（P0/P1/P2）

博客可能存在多个内容集合（如 astro-blog-shokax 的 `posts` + `moments`）：

1. **生成集合类型信息**：在博客仓库根执行 `hyc collections` → 运行时读取 `src/content.config.ts`（jiti 加载 + astro 虚拟模块 shim）→ 生成**可提交**的 `hyacine.collections.json`（每集合：name/dir/pattern/扩展名 + 输入形状 JSON Schema + ui 字段描述：date/enum/string[]/secret/image）。字段级信息用于管理台表单渲染与保存前校验。
   - 降级：无配置文件或 astro 未安装时读 `.astro/collections/*.schema.json`（需先跑 `astro sync`），目录猜测 `src/<name>`。
   - 弱来源（降级）不覆盖已有强来源文件；`--force` 强制覆盖。
2. **集合注册**：`hyacine.yml` 显式声明 `collections:`（name → 目录）。未声明时自动合并 `hyacine.collections.json` 的 name → dir（**生成即生效**），缺省回退单集合 `posts → contentDir`。
   ```yaml
   contentDir: src/posts
   collections:
     posts: src/posts
     moments: src/moments
   ```
3. **路径语义（重要）**：内容路径为 **repo 相对**（`src/posts/hello.md`、`src/moments/foo.md`）。CLI/桌面 scan 全部集合目录；`/api/export` 快照与 git workflow 直接按 repo 相对写回/上传，**无需目录映射**。
   - 升级：一次 `hyc sync`（或桌面 Sync 页）后旧的相对 contentDir 路径自愈删除（deletedPaths 差集）。
4. **workflow v2**：`hyacine-bridge.yml` 从 `hyacine.collections.json` 读取集合目录（兜底 `src/posts`），import job 只收集集合目录下变更文件，export job 按 repo 相对路径写回。
5. **集合过滤**：`GET /api/posts?prefix=<dir>` 按目录前缀过滤（如 `prefix=src/moments`）；管理台 Posts 页显示「集合」列。

> AI autogen 目前全集合生效；若要按集合关闭（如 moments 不生成摘要/嵌入），后续在云端配置加路径前缀规则即可。

## 4. CLI

### 4.1 构建与安装

```bash
pnpm --filter @hyacine/cli build        # tsdown → dist/index.js（bin: hyc）
# 本地使用：
pnpm --filter @hyacine/cli link         # 或 npm i -g
hyc --version
```

### 4.2 与云端对接

```bash
# 登录（用 3.6 拿到的 setup code；--url 为 worker 域名）
hyc login --url https://<worker> --code <SETUP_CODE>
hyc status        # 查看远端/本地状态
hyc tokens:list   # 管理 token
```

### 4.3 常用命令

| 命令 | 说明 |
|---|---|
| `hyc install [dir]`（别名 `setup`） | 安装博客（克隆 `theme-shoka-x/astro-blog-shokax` 模板，`--source github/gh-proxy/gh-proxy-v6`，`--install` 装依赖） |
| `hyc init` | 现有目录初始化 `hyacine.yml` + 目录结构 |
| `hyc new <title>` / `list` / `edit` / `rename` / `move` | 文章管理（多集合：list 展示集合；new 写入首个集合） |
| `hyc collections` | 从 Astro 内容集合生成 `hyacine.collections.json`（类型信息：schema + UI 字段） |
| `hyc sync` | 全量索引上行（hash diff），返回 `ai.needs` |
| `hyc ai:summary` / `ai:embed` / `ai:similar` | 按需跑 AI 产物 |
| `hyc build` / `preview` / `deploy` | 博客构建/预览/部署（git push） |
| `hyc stats` / `backup` | 统计/备份 |

> slug 策略：显式 slug 神圣（保留中文）；自动生成时中文标题转拼音（`你好世界`→`ni-hao-shi-jie`）。

---

## 5. 桌面应用（Tauri）

### 5.1 开发运行

```bash
pnpm --filter @hyacine/console dev   # vite dev（localhost:5199，带 COOP/COEP 头）
pnpm tauri dev                       # 或 cd apps/desktop && pnpm tauri dev
```

> 编辑器预览基于 satteri WASM，**要求页面 cross-origin isolated**（SharedArrayBuffer）：dev 靠 vite `server.headers`，生产靠 `tauri.conf.json` 的 `app.security.headers`（COOP/COEP 已配置）。

### 5.2 Windows 生产构建（MSVC 要点）

```bash
# 1) 初始化 MSVC 环境（VS 2026 Community 非默认路径）
cmd /c "\"C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat\" >nul 2>&1 && cd /d apps\desktop\src-tauri && cargo build"

# 2) 或直接出安装包（自动先 build console）
cd apps/desktop
pnpm tauri build
# 产物：apps/desktop/src-tauri/target/release/bundle/…
```

注意：
- **必须**先 vcvars64 再 cargo（直接 cargo 会因 Git Bash 的 link.exe 遮蔽报 `link: extra operand`/找不到 cl.exe）。
- `tauri build` 的 `beforeBuildCommand` 会先重建 console dist，避免 exe 内嵌旧前端。
- 图标/资源：`icons/icon.ico`（Windows 资源）+ `icon.png`。

### 5.3 首启流程

1. 登录页 → 输入 API 地址 + SETUP_CODE 登录云平面；或
2. **「安装 Blog（Setup 模式）」**：选目录 → 克隆模板 → （可选）`pnpm install` → 完成在 Workspace 打开；或
3. **「跳过登录，进入本地模式」**：纯本地文件操作（选目录 → 列表/新建/编辑/保存/`git commit`），不需 API。

桌面能力矩阵：

| 能力 | 离线 | 需登录（云平面） |
|---|---|---|
| 选择目录/列表/编辑(源码+satteri 预览)/保存 | ✓ | — |
| git commit / push | ✓ | — |
| 云平面页（dashboard/posts/sync/assets/tokens） | ✗ | ✓ |
| AI 摘要（Editor 按钮） | ✗ | ✓ |

---

## 6. 云端同步流程（CLI/桌面 → API）

首次部署后建议按序：

```bash
# 1) 安装/初始化博客并编辑内容
hyc install ~/my-blog --install
cd ~/my-blog && hyc new "你好世界"

# 2) 登录云端并全量同步
hyc login --url https://<worker> --code <SETUP_CODE>
hyc sync
# → 返回 ai.needs: [{hash, path, reason:"both"}, …]

# 3) 按需生成 AI 产物（也可在桌面编辑器点「AI 摘要」）
hyc ai:summary    # 摘要（写回 frontmatter summary* 键，hash 不变）
hyc ai:embed      # 嵌入（存 D1）

# 4) 资产直传 R2（图片等，可选：未配 R2 时 presign 返回 503，跳过即可）
#    桌面 Assets 页 presign 直传；CLI 侧走同步登记

# 5) 提交并推送博客仓库（触发线上构建）
git add -A && git commit -m "update" && git push
```

> 摘要物化只写 `summary/summaryModel/summarySourceHash/summaryUpdatedAt`，不改变正文 hash → 不会触发「物化→hash 变→再 AI」死循环。

---

## 7. 常见问题排查

| 现象 | 原因 / 处理 |
|---|---|
| `/api/health` 404 或 5xx | 未部署 / D1 未建表 → `migrate:remote` |
| `needsSetup:true` | 未配置 `SETUP_CODE` secret |
| setup 返回 401 invalid_code | SETUP_CODE 与请求不符；或触发了限流（10 次/分/IP）等 1 分钟 |
| presign PUT 403 | R2 bucket CORS 未设置（浏览器直传）；或 R2 凭据/endpoint 错 |
| AI summary 502 ai_failed | `AI_SUMMARY_ENDPOINT/KEY/MODEL` 未配或模型不可用；正文过长被截到 8000 字符 |
| AI embed 503 ai_not_configured | Worker 未绑定 `[ai]`（wrangler.toml 的 AI binding） |
| 桌面预览白屏/报 wasm | 页面未跨域隔离：dev 检查 vite 头，生产检查 `tauri.conf` security.headers |
| 桌面选目录「无权限」 | v0 已放开 fs scope 到 `**`；后续收紧为动态授权 |
| 中文 slug/文件名 sync 400 | 需更新 contract（`SlugSchema/PostPathSchema` 已支持 Unicode），确保两端同版本 |
| token 撤销无效 | tokenId 是 hash 前 16 位前缀，revoke 用前缀匹配（范围查询） |

---

## 8. 安全清单

- `SETUP_CODE` 强随机且 ≥ 8 位（代码里做了长度校验 + KV 限流）。
- R2 API 凭据只授予该 bucket 的最小权限（R2 对象读写 token）。
- Token 只返回一次明文（`token_hash` 存库）；撤销走前缀匹配。
- 桌面 fs scope 全盘 `**` + shell 白名单（git/pnpm/npm/bun）为 v0 权衡，生产建议改为「对话框选中目录后动态授权」。
- Worker `app.use(cors({origin:"*"}))` 面向 Bearer token 鉴权场景，无 Cookie；如需收紧改显式 Origin 白名单。

---

## 9. 升级 / 回滚

- **API**：`wrangler deploy`（新代码）+ 必要时 `migrate:remote`（新迁移文件放 `packages/api/migrations/`）。回滚：`wrangler rollback`。
- **桌面**：重新 `tauri build` 产物分发；旧版本不受云端 schema 变更影响（离线优先）。
- **CLI**：`pnpm --filter @hyacine/cli build` 后重新 link/发布。
