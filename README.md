# hyacine

astro-blog-shokax 配套平台：一张 D1/KV/R2 之上的无状态工具链。

> 部署指南见 [DEPLOY.md](./DEPLOY.md)（Cloudflare Worker + CLI + 桌面端完整流程）。

## 组件

| 包                  | 说明                                                           | 运行时                              |
| ------------------- | -------------------------------------------------------------- | ----------------------------------- |
| `packages/contract` | zod schemas + 推导类型 + typed client（三端唯一真相）          | 纯 TS，零依赖（仅 zod）             |
| `packages/api`      | Cloudflare Worker (Hono)：认证、索引 sync、AI 端点、R2 presign | workerd (@cloudflare/workers-types) |
| `packages/cli`      | hyc 续作：本地模式（纯 fs，无状态）+ 远程模式（经 API）        | Node ≥ 22                           |

## 架构决策（/grilling 2026-08-24 定稿）

- **文件/git 为真相，D1 是派生索引**。构建永远离线：AI 产物物化回 frontmatter 后再 commit。
- **严格切割双状态**：未配置 api.url+token = 本地模式（fs+git+build+备份+主题配置）；配置后 = 远程模式（+AI/统计/sync）。无降级近似，`--local` 可强制。
- **单租户自托管**：无 tenants 表；BYOK（AI key 部署级配置，密钥不出 worker）。
- **认证**：setup code（worker secret）交换长期 Bearer，scopes: `posts.r` `posts.w` `ai` `admin`。
- **AI**：摘要走 BYOK OpenAI 兼容端点；嵌入走 Workers AI text-embeddings，向量存 D1 blob 全表 cosine（>5k 篇再升 Vectorize）。
- **资产管线**：R2 presigned 直传，图片处理在本地 sharp，Workers 只签名不碰字节。
- **部署**：git push 触发 CI；桌面/管理台与博客同城无关。

## 里程碑

- [x] M0 设计定型（/grilling）
- [x] M2 云端闭环：contract + api + cli（本地/远程/物化）
- [x] M3 管理台 SPA（apps/console：统计/文章+AI 状态/sync/资产/令牌/设置）
- [x] M4 Tauri 桌面壳（apps/desktop：本地工作台/Milkdown 编辑器/frontmatter 表单/Git 面板/AI 物化，Windows MSVC 构建）

## 桌面（M4）验证

```bash
# MSVC 链：VS 2026 Community（18/Community）+ WinSDK 10.0.28000
# cargo 必须经 build.bat（Git Bash 的 link.exe 会遮蔽 MSVC linker）
cmd /c "scripts\build.bat build --manifest-path apps\desktop\src-tauri\Cargo.toml -p hyacine-desktop"
# 产物：apps/desktop/src-tauri/target/debug/hyacine-desktop.exe
# 开发调试：pnpm --filter @hyacine/desktop dev（console dev 端口 5199）
```

**桌面离线模式**：工作台/编辑器/Git 属文件平面——无需 API 登录即可用（严格切割）：
选博客目录 → 编辑/新建文章 → git commit。云平面（仪表盘/文章索引/同步/令牌/AI 摘要）
才需要登录；登录页可「跳过登录，进入本地模式」。

## 本机验证（M2 验收路径）

```bash
# API（本地 miniflare，无需 CF 账号）
cd packages/api
cp .dev.vars.example .dev.vars   # 填 SETUP_CODE / AI 端点
pnpm exec wrangler d1 migrations apply DB --local
node scripts/smoke.mjs            # health→setup→sync→presign 全链

# CLI 端到端（需要另一个终端跑 wrangler dev --local）
cd packages/cli && pnpm run build
cd <博客项目>
hyc list                                 # 本地模式：纯文件
hyc login --url http://127.0.0.1:8787 --code <SETUP_CODE>
hyc sync && hyc ai:summary --all          # 索引上行 + 摘录物化回 frontmatter
```

> 本地 miniflare 的 Workers AI binding（embed）不可用，ai:embed / ai:similar 需远程环境；
> BYOK 摘要（OpenAI 兼容端点）本地可跑通（把 AI_SUMMARY_ENDPOINT 指向自建 stub）。

## 开发

```bash
pnpm install
pnpm run check   # lint:ci + format:ci + typecheck + test
```
