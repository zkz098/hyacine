# SPEC-CONSOLE：apps/console（hyacine 管理台 SPA）

> 供施工 worker 阅读。这是 M3 里程碑：云平面管理台（用户已确认职责边界与语言策略）。
> **契约与 API 已就绪**：`packages/contract` 含 `postsList()/assetsList()/stats()/syncLog()/tokens/health/setup/presign/registerAsset`——console 只消费，禁止改动。

## 定位（已定死，不得越界）

- **云平面管理台**：统计、文章索引+AI 状态、同步历史、远程资产、令牌、设置。**不含正文编辑**（正文编辑在 CLI/Desktop 文件平面；API 无正文）。
- **同时是 M4 Tauri 的壳**：纯净 SPA。`src/**` 禁止任何 node 内置模块（fs/path/os）、禁止 SSR。
- **中文先行**：界面全中文，但结构预留 i18n（`t(key)` 封装 + 字典文件就位，en 暂为空壳）。

## 工程

- 目录 `apps/console`，包名 `@hyacine/console`，`"private": true`，`"type": "module"`，engines node>=22。
- scripts：`dev`（vite）、`build`（vite build）、`preview`（vite preview）、`typecheck`（tsc --noEmit）、`test`（vitest run）。
- 依赖：solid-js ^1.9、@solidjs/router、vite、vite-plugin-solid、unocss、@unocss/preset-wind4、@unocss/preset-icons、@iconify-json/ri、zod（经 contract 用，可不直装）、@hyacine/contract（workspace:*）。
- devDeps：typescript、vitest、jsdom、@solidjs/testing-library、@testing-library/jest-dom（如需要）、@types/node。
- `vite.config.ts`：plugins [solid(), unocss()]，`base: "./"`（静态托管子路径安全）。
- `uno.config.ts`：presets wind4 + icons（icons: { extraProperties: { display: "inline-block" } }——图标必须可见，ri 图标 0×0 的坑），configFile 正常加载。
- tsconfig：extends 根 base，`"lib": ["ESNext", "DOM", "DOM.Iterable"]`，`"jsx": "preserve"`（vite-plugin-solid 处理），include src + vite/uno 配置。
- 根 pnpm-workspace `apps/*` 已覆盖，根 install 自动纳入。

## 状态与路由

- `src/store/api.ts`：ApiContext（createContext + 顶层 provide），createStore{ baseUrl, token, theme }，localStorage 持久化（key `hyacine.apiUrl` / `hyacine.token` / `hyacine.theme`）；导出 `getClient()` 返回单例 HyacineClient（注入 baseUrl/token；token 变更时 setToken）。
- 鉴权守卫：无 token → 重定向 `/login`；任何请求 401 → 清 token → `/login`（提示）。
- **HashRouter**（静态托管无 rewrite 诉求）：
  - `/login` 登录（api url + setup code → client.setup → 存 token → 跳 /dashboard）
  - `/dashboard` 统计
  - `/posts` 文章索引
  - `/sync` 同步历史
  - `/assets` 远程资产
  - `/tokens` 令牌管理
  - `/settings` 设置
- 布局：`src/layouts/AppLayout.tsx` —— 侧边栏（logo「hyacine」+ 导航项，ri 图标）+ 顶栏（主题切换、连接状态点、登出）；移动端侧栏抽屉（汉堡按钮切换）。

## 页面细节

| 页 | 数据源 | 内容 |
|---|---|---|
| login | health、setup | url 输入（预填 localStorage）+ code 输入 + 登录按钮；health.needsSetup 提示「需要部署时配置 SETUP_CODE」；错误内联提示 |
| dashboard | stats | 卡片：文章总数/草稿/已发布、资产总数/远程数；byMonth 迷你柱状图（CSS 高度百分比，无图表库）；byCategory chips |
| posts | postsList | 表格：标题 / slug / 草稿徽标 / 分类 / 更新时间 / AI 摘要（✓绿·✗灰，title 显示 model）/ AI 嵌入（同）/ hash（鼠标悬停 title）；本地过滤输入；刷新按钮；加载骨架 |
| sync | syncLog | 表格：时间 / 文章数 / 变更 / 删除 |
| assets | assetsList、presign、registerAsset | 列表（path/type/fileType/size/r2Key/更新时间）；上传：选择文件 → presign({key:`images/<文件名>`, contentType, size}) → fetch PUT（method/headers 按响应用）→ registerAsset → 刷新；上传错误提示（含「R2 bucket 需配置 CORS」部署提示） |
| tokens | listTokens、createToken、revokeToken | 列表（label/scopes/expires/revoked + 撤销按钮）；创建表单（label、scopes 多选默认全选、expiresInDays 空=永久）；创建成功显示一次明文 token + 复制按钮 |
| settings | health、本地存储 | API URL 编辑保存；「测试连接」显示 health（ai.summary/embed 布尔 + needsSetup）；主题切换（亮/暗）；登出（清 token）；版本信息 |

## 主题

- 亮/暗双主题：`document.documentElement.dataset.theme = "light"|"dark"`。
- `src/styles/theme.css`：CSS 变量（--bg,--surface,--text,--muted,--border,--accent,--danger,--ok 等），`:root` 亮、`[data-theme="dark"]` 暗；全局 reset（@unocss/reset 或手写 minimal）。
- 组件用 uno 排布（flex/grid/padding/rounded） + 变量上色（bg-[var(--bg)] 或语义类 `.surface`/`.text-muted` 等少量辅助类放 theme.css）。
- 顶部主题切换按钮（ri: sun/moon-line）。

## i18n

- `src/i18n/index.ts`：`t(key, params?)` + `dict`（zh-cn 全量、en 空壳），locale 常量 v0 固定 `zh-cn`。
- 所有面板文案走 t()；字典键 `页面.键`。

## 错误处理

- `src/store/errors.ts`：`messageOf(err)`——HyacineApiError 按 code 映射中文（unauthorized→登录失效请重新登录；network_error→无法连接 API；ai_failed→AI 服务错误；其余→err.message）；非 API 错误→String(err)。
- 页面级错误用内联 alert 组件 `src/components/Alert.tsx`（variant: error/info），不弹窗。

## 测试（vitest + jsdom + @solidjs/testing-library）

- 覆盖：api store（login 存 token / 401 清 token）、settings 持久化、posts 页渲染（**注入 mock fetch**——client 支持 fetch 选项，用 vi.fn 按 url 分发）、tokens 创建表单提交。5~10 个用例足矣。
- vitest 配置：environment jsdom，setup 文件加 jest-dom（如需）。

## 验收（worker 必须全过并汇报）

1. `pnpm install`（worktree 根）
2. `pnpm --filter @hyacine/console typecheck`、`test`、`build`（vite build 成功，产物 dist/index.html 存在）
3. 根 `oxlint --type-aware --type-check .` 无 error、`oxfmt .`
4. `vite preview` 冒烟：起服务后 curl index.html 200 + 页面含 # 路由壳
5. git add/commit（规范消息）并汇报：实现摘要、测试数字、页面清单、与规格偏差及原因

## 禁止

- 禁止改 contract/api/cli/根配置。只新增 `apps/console/**`（根 pnpm-lock 变化允许，由 install 产生）。
- 禁止 node 内置模块、禁止 SSR、禁止图表库（echarts 等，CSS 柱状图即可）、禁止引入 OAuth。
- 禁止做正文编辑/上传正文（云平面无正文）。
- 禁止新建其他包（desktop 后续轮）。