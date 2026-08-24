# SPEC-CLI：@hyacine/cli（Node，bin=hyc）

> 供施工 worker 阅读。契约唯一真相：`packages/contract`（本仓库 main 分支已含，你的 worktree 中已有）。
> API 的 HTTP 形状以 contract client 方法为准（客户端发什么、收什么必须符合）。

## 目标

实现 hyc 续作 CLI（Node ≥ 22）。**本地模式**（纯 fs、无状态、无本地数据库）与**远程模式**（连接 API 全功能）。验收：本地命令无 API 可跑；远程命令对接（mock 或真 API）走通；摘要物化写回 frontmatter。完成后并入 main 由主编做端到端联调。

## 硬约束（/grilling 已定）

- **严格切割，无降级近似**：AI/统计/sync 只在远程模式可用；本地模式执行时明确报错（提示登录）。同一命令两态行为一致。
- **显式两态**：`conf` 里有 `api.url`（且 token 已登录）= 远程；否则本地。`--local` 强制临时本地。断网 → 远程命令报 friend 错误。
- **无本地数据库**：本地模式任何命令不写 sqlite/lmdb。状态快照（可选，见 sync）只是小 JSON 存 conf，不是数据库。
- **文件为真相**：CLI 永远不把云端内容写回正文（只物化 AI 产物进 frontmatter，见 ai:summary）。

## 工程

- 目录 `packages/cli`，包名 `@hyacine/cli`，`"private": true`（v0 不发布；发布后续轮），`"type": "module"`。
- `bin` 字段映射 `dist/index.mjs`，package.json 加 `"bin": {"hyc": "./dist/index.mjs"}`，根 `"exports"` 不必须（CLI 不需要被 import）。
- 构建 `tsdown`：`tsdown src/index.ts -d dist --target node22 --format esm --minify --clean`。deps（运行时 external）：commander、conf（或自写 JSON conf）、@inquirer/prompts、gray-matter、yaml、rapidhash-js（内容 hash，与 hyc 一致）、tar（备份）。`@hyacine/contract: workspace:*`。
- scripts：`typecheck`、`test`（vitest run）、`build`、`dev`（tsdown --watch）。
- tsconfig：extends 根 base；`"lib": ["ESNext", "DOM"]`（Node 的 fetch 需要 DOM 类型；@types/node 24 不再内置）、`"types": ["node"]`。devDeps：typescript、vitest、tsdown、@types/node。
- i18n：**小字典双语言**（en/zh-cn），`src/i18n.ts` 提供 `t(key, params)` + `locale`（env `HYACINE_LANG` > conf `lang` > 系统），字典 key 按 `命令.场景` 组织。别上 i18next。

## 模块布局

```
src/
  index.ts          commander 装配（program、全局 --local/-c/--json、命令注册、错误出口）
  cli/              （薄层：解析 argv → 调 services，错误→i18n 消息→exit code）
  config/index.ts   项目配置读取（hyacine.yml 解析 + 默认）
  config/project.ts findProjectRoot（向上找 hyacine.yml 或 package.json）
  remote/state.ts   conf 管理（api.url/api.token/lastSync 快照）
  application/      业务逻辑（与 hyc 同构命名风格，便于未来搬 use case）
    posts/*.ts      new/list/edit/rename/move 的 fs 操作
    materialize.ts  frontmatter 读/写/物化
    sync.ts         sync 全量快照构造 + diff 报告
    ai.ts           ai:summary/ai:similar/ai:embed 编排
    backup.ts       tar 打包
    build.ts        探测并 spawn build/preview
    git.ts          git 操作（spawn git）
    stats.ts        远端统计展示
  frontmatter.ts    gray-matter 封装（parse/stringify/materialize）
  slugify.ts        slug 生成
  hash.ts           rapidhash-js 内容 hash
  i18n.ts
  langs/en.json, langs/zh-cn.json
```

## 项目配置

读取 `hyacine.yml`（astro-blog-shokax 已有此文件：contentDir/src/posts、assetsDir/src/assets 等）。`yaml` 包解析；缺失键用默认：

- `contentDir` 默认 `src/posts`
- `assetsDir` 默认 `src/assets`
- `postExtension` 默认 `[".md", ".mdx"]`
  findProjectRoot：向上找 `hyacine.yml` 或含 `package.json` 的目录；找不到 → 错误 `not_in_project`（提示 `hyc init`）。

## 本地模式命令（无 API，全部可跑）

| 命令                            | 行为                                                                                                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hyc init`                      | 若缺 hyacine.yml 生成默认配置；建 contentDir/assetsDir；打印下一步                                                                                                                             |
| `hyc new [title]`               | inquirer：标题→slug 化（中文转拼音可不做，保留原文 slugify 规则）、分类（多选）、标签、draft；写 md 模板（frontmatter: title/slug/date/categories/tags/draft）；打印路径；打开 $EDITOR（可选） |
| `hyc list [query]`              | 扫 contentDir，表格（title/slug/draft/updated），--json 输出源码；query 做模糊过滤                                                                                                             |
| `hyc edit <query>`              | 模糊查找（文件名/slug/title 子串）→ $EDITOR 打开（无 $EDITOR 用 `notepad`/EDITOR fallback 报错提示）                                                                                           |
| `hyc rename <query> <new-name>` | 改文件名（slug 保持除非同名冲突），--also-slug 改 frontmatter slug                                                                                                                             |
| `hyc move <query> <dest-dir>`   | 移到分类目录（相对 contentDir）                                                                                                                                                                |
| `hyc build` / `hyc preview`     | 探测 package.json `astro build`/`astro preview`（或 `build` script），spawn 传递退码                                                                                                           |
| `hyc deploy [message]`          | git add -A → commit（默认 `chore: update blog <date>`）→ push 当前分支；--no-push 只 commit；非 git 仓库报错                                                                                   |
| `hyc backup`                    | tar.gz：contentDir+assetsDir+hyacine.yml+主题配置（若存在）→ `backups/hyacine-<ts>.tar.gz`（.gitignore 里加 backups/）                                                                         |
| `hyc theme:config view\|edit`   | view 打印，edit 打开 $EDITOR                                                                                                                                                                   |

## 远程模式命令（需 `hyc login`）

| 命令                                                                             | 行为                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hyc login`                                                                      | 提示 api.url + setup code → `client.setup()` → conf 存 {api.url, api.token}；Health 探测 needsSetup 提示                                                                                                                                                                                                                                          |
| `hyc logout`                                                                     | 清 token                                                                                                                                                                                                                                                                                                                                          |
| `hyc status`                                                                     | 模式、url、token label/scopes、上次 sync 时间、（远程）health + ai 配置状态                                                                                                                                                                                                                                                                       |
| `hyc tokens:list` / `tokens:create <label> -s posts.r,ai` / `tokens:revoke <id>` | admin                                                                                                                                                                                                                                                                                                                                             |
| `hyc sync`                                                                       | **全量快照**：扫 all posts（frontmatter 提取 path/slug/title/draft/categories + rapidhash 内容 hash + 时间戳）；扫 assetsDir 生成登记条目（is_remote=false, checksum, 图片/字体/其他分类）；deletedPaths = 上次快照有而本次无（conf 存 lastSync 快照）；`client.syncUpload()`；报告 accepted/changed/unchanged/deleted/ai.needs（表格）；存新快照 |
| `hyc ai:summary <query\|--all> [--force] [--dry-run]`                            | 对选定 posts：读文件全文→`client.aiSummary({hash,content})`→**物化**：写回 frontmatter（summary/summaryModel/summarySourceHash/summaryUpdatedAt 四个日期键），report 已写文件；--force 忽略缓存；--dry-run 只打印不写                                                                                                                             |
| `hyc ai:similar <query>`                                                         | `client.aiSimilar({hash,limit})` → 表格（path/title/score）                                                                                                                                                                                                                                                                                       |
| `hyc ai:embed <query\|--all>`                                                    | 本地切 chunk（最大 ~800 字符/段，按段落/句子切，重叠 0）→ `client.aiEmbed`，存 server 端                                                                                                                                                                                                                                                          |
| `hyc stats`                                                                      | `client.stats()` → 表格（totals/categories 榜/byMonth 条/assets）                                                                                                                                                                                                                                                                                 |

**模式判定**：conf.api.url 存在 && 已 login → 远程；`--local` 强制本地（此时 ai/sync/stats/tokens 报错：`remote_only_required`）。**HyacineApiError 映射**：network_error→“无法连接 API，检查 hyc status”；unauthorized→“登录失效，请 hyc login”；ai_failed 等透传 message。

## 前端物化（materialize.ts，重点）

- 用 gray-matter parse `---` frontmatter；写入四键（已有则更新）；`stringify` 回写。**注意**：gray-matter 重排未知键风险已评估可接受（v0），但必须保：注释会丢（mark 到报告里）。
- 幂等：summarySourceHash === 当前内容 hash 且 summaryExists 且非 --force → 跳过。
- 写文件后用原文件权限/换行符保持（读原文本 + 字节结尾 \n 检查，stringify 后补 \n）。

## 测试

- vitest node env。fixtures 用临时目录（os.tmpdir 下复制最小项目骨架：hyacine.yml + 1md）。
- 覆盖：frontmatter parse/materialize 幂等（摘要写回后重读相等 + hash 不变字段保留）、slugify、index 提取（hash/categories/时间戳）、sync 快照 diff 逻辑（构造两次快照断言 deleted 集合）、模式判定（conf 有无 url）、ai:summary 物化链路（**mock API**：本地 http server 或用 contract client 注入 fetch mock——client 支持注入 fetch，直接 vi.fn 即可）、命令错误退出码。
- 远端命令的 API 交互全部用 mock（不依赖真 API）。

## 交付清单

1. `packages/cli/**` + 构建产物不提交（dist gitignore）
2. 全部验证：`pnpm install`、`tsc --noEmit`、`vitest run`、`tsdown build` 成功、`oxlint`（根）、`oxfmt`（根）
3. 手工冒烟：在 fixture 项目里跑 `hyc new/list/edit/backup`（本地）+ 对着 mock API 跑 `hyc login/sync/ai:summary --dry-run`
4. 完工报告：实现摘要、测试数字、与 hyc 旧 CLI 的能力对照（哪些迁了/哪些砍了/为什么）

## 禁止

- 不写任何本地数据库（sqlite/lmdb/lowdb 一律禁止）。
- 不改 contract 包、不改根配置、不新建其他包。
- 不内置/调用真实 AI key；测试全 mock。
- 不做降级近似：本地模式 AI 命令必须报错，绝不“离线近似”。
- 不实现管理台/桌面（后续轮）。
