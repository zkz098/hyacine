# SPEC-DESKTOP：M4 Tauri 桌面壳 + 桌面特性（编辑器全套）

> 供施工 worker 阅读。范围已与用户确认：**编辑器全套**。契约与 API 就绪（packages/contract），
> console（apps/console）已存在且为 M4 的壳基座——桌面=同代码库双运行时的 Tauri 运行时。

## 定位与约束（已定死）

- **同一代码库双运行时**：桌面特性**内嵌在 apps/console**（运行时 `isTauri()` 检测启用），`apps/desktop` 只是 Tauri 壳（Rust + 配置 + 插件），frontendDist 指向 console 构建产物。
- **WebUI 不受影响**：桌面代码不得破坏纯浏览器构建/运行（tauri 相关 import 必须动态、惰性、isTauri 守卫后）。
- **文件平面 + 云平面**：桌面=文件平面深度工作（本地选题/编辑/git）+ 云平面（同步/AI，需连接）；离线可编辑，AI 无连接明确报错（沿袭严格切割）。
- 沿用已定决策：Milkdown WYSIWYG 编辑器；frontmatter 走**结构化表单**（不塞进正文）；git push 触发 CI 部署；AI 摘要=本地读正文→API→物化四键写回。
- 中文先行 i18n 结构（en 留空壳），与 console 现有 i18n 合并扩展。
- 本机 MSVC 链：`C:/Program Files/Microsoft Visual Studio/18/Community/VC/Auxiliary/Build/vcvars64.bat`（VS 2026 Community，工具集 14.44/14.51，WinSDK 10.0.28000）。**cargo 必须经 cmd + vcvars64 调起**（Git Bash 的 /usr/bin/link.exe 会遮蔽 MSVC linker）。

## 工程：apps/desktop（Tauri 壳）

- package.json：`@tauri-apps/api`、`@tauri-apps/plugin-fs`、`@tauri-apps/plugin-shell`、`@tauri-apps/plugin-dialog`（deps）；`@tauri-apps/cli`（devDep）；scripts：`dev`（tauri dev）、`build`（tauri build）、`build:debug`（tauri build --debug --no-bundle）、`cargo:check`（见下方 build.bat）。
- `src-tauri/Cargo.toml`：`[lib] crate-type staticlib/cdylib` + `[[bin]]` 标准 tauri 模板；deps `tauri = { version = "2", features = [] }`、`tauri-plugin-fs = "2"`、`tauri-plugin-shell = "2"`、`tauri-plugin-dialog = "2"`；build-dep `tauri-build = "2"`。
- `src-tauri/src/main.rs` + `lib.rs`：标准 tauri 2 启动，注册 fs/shell/dialog 插件；Rust 侧无需业务逻辑（全部在 TS 侧走插件）。
- `src-tauri/tauri.conf.json`：
  - `identifier: "com.hyacine.desktop"`、`productName: "hyacine"`、`version: "0.1.0"`
  - `build`: `beforeDevCommand: "pnpm --filter @hyacine/console dev"`、`devUrl: "http://localhost:5199"`、`beforeBuildCommand: "pnpm --filter @hyacine/console build"`、`frontendDist: "../console/dist"`
  - `app.windows`: title "hyacine"、width 1280、height 800、minWidth 960、minHeight 640、resizable true
  - `bundle`: active true、targets ["nsis"]? **v0 设 bundle.active false 也行但图标仍需要**——严格按 tauri 文档：`bundle.icon` 需要真实图标文件；配 `active: true, targets: ["nsis"]`，但**验证只到 cargo build**（不打 bundle，安装器 PowerShell/探索留到工具链完备后的真机验证）。
  - **图标**：生成最小图标集（1024.png → ico/icns/icon.png）。生成方式：写一个纯 node 脚本生成单一色块 1024x1024 PNG（node:zlib 手写 PNG chunk，~30 行，无需 sharp），再 `npx tauri icon <png> -o src-tauri/icons`。若 tauri icon 不可用，把确认存在的文件路径写进 bundle.icon（worker 保证 cargo build 不因图标报错，必要时 bundle.active 设 false 仅做 debug build 验证并在报告说明）。
- `src-tauri/capabilities/default.json`：
  - `core:default`；fs：`fs:default` + scope **["$HOME/**", "$DOCUMENT/**", "$DOWNLOAD/**"]**（个人桌面工具 v0 取舍，注释写明安全考量与后续收紧方向）；shell：`shell:allow-execute` + 命令白名单 `["git"]`（按 tauri 文档的 scope 语法配置，args 校验从宽 `{name:"git", args:true}` 并注释说明 v0 取舍）；dialog：`dialog:allow-open`（directory 选择）。
- `scripts/build.bat`（仓库根，worker 创建）：`@echo off` + `call "C:/Program Files/Microsoft Visual Studio/18/Community/VC/Auxiliary/Build/vcvars64.bat"` + `cargo build -p hyacine-desktop %*`（记忆中的 house 模式，Git Bash 的 link.exe 遮蔽规避）。桌面 dev/build 一律经 build.bat 或 cmd。

## console 桌面特性（apps/console/src，全部 isTauri 守卫）

### 桥接与守卫

- `src/tauri/bridge.ts`：
  - `isTauri(): boolean` —— `window.__TAURI_INTERNALS__ !== undefined`。
  - 惰性导出：`openFolderDialog()`、`readTextFile(p)`、`writeTextFile(p, c)`、`listDir(p)`（递归 + 过滤）、`gitExec(args)`（shell execute，返回 {stdout,stderr,code}）——**全部 `await import("@tauri-apps/plugin-*")` 于函数内部**，WebUI 永远不触发。
  - 非 tauri 环境调用任一 → throw 明确错误（`require_tauri`）。
- 桌面检测在 store：`desktopMode = isTauri()`（启动时判定一次，session 内不变）。

### frontmatter 工具（console 侧，浏览器/WebView 安全）

- `src/lib/frontmatter.ts`：gray-matter + yaml core schema engine（**与 CLI 完全同款自定义 engine**：`{schema:"core"}` 保 date 字符串不被重写成 ISO；parse 用 typeof 守卫收 object）。函数：parseFrontmatter / stringifyFrontmatter / materializeSummary（四键：summary/summaryModel/summarySourceHash/summaryUpdatedAt）/ hasUpToDateSummary。新增 console deps：`gray-matter`、`yaml`。
- `src/lib/postHash.ts`：`postBodyHash(raw)`（sha256-16 over 正文，**先剥 frontmatter**——复用 M2 教训：hash 只覆盖正文，物化不改变 hash）。

### 项目与本地文章 store

- `src/store/project.ts`（desktopMode only）：`projectDir`、`config`（读取 `<dir>/hyacine.yml` 解析 contentDir/assetsDir，缺省 src/posts/src/assets；无 hyacine.yml 也允许，报一次提示）、`postInfos`（递归扫 contentDir 的 .md/.mdx：`{path, title, slug, draft, categories, hash, summaryPresent, updatedAt}`，frontmatter+hash 解析）、`newPost(title)`（模板脚手架）、`openInEditor(path)`（存 current path 供 /editor）。
- 动作即存即写（无自动保存节流 v0；保存按钮 + Ctrl+S 快捷键）。

### 页面（仅 desktopMode 显示于导航）

- `/workspace` 工作台：空态（项目未选）→「选择博客目录」联 dialogs.open({directory:true})；选中后显示项目路径 + 文章列表（标题/草稿徽标/摘要存在✓/更新时间）+ 新建按钮 + 每行「编辑」。
- `/editor?path=...` 编辑器：
  - 左：frontmatter 结构化表单（title/slug/categories(逗号分隔 string)/tags/draft 开关/date）；右/下：Milkdown WYSIWYG 正文。
  - 顶：保存（fs 写回，frontmatter yaml core + body 拼接，尾 \n 保底）、「AI 摘要」按钮（require 远程：读全文 → `client.aiSummary({hash: postBodyHash, content})` → `materializeSummary` → 写回；无连接 → messageOf 报错）、跳转 git。
- `/git` Git 面板：`git status --porcelain` 列表（新增/修改/删除，中文标注）、暂存全部 + commit（默认消息 `chore: update blog <date>`）、push（含当前分支显示）；输出/错误区。
- `/settings` 增补桌面项：当前项目目录 + 重新选择；本机 Git 可用性探测（git --version）；其余沿用。

### Milkdown 集成（SolidJS 手动挂载）

- deps：`@milkdown/core`、`@milkdown/preset-commonmark`、`@milkdown/plugin-history`、`@milkdown/plugin-listener`、`@milkdown/theme-nord`（或 choose 风格接近者）——**全部同一 exact 版本**（安装时确认 resolved 版本一致，不匹配必报错）。
- `src/components/MilkdownEditor.tsx`：Props { initialMarkdown, onChange(getMarkdown) }；ref div；onMount 创建 `Editor.make().config(themeNord).use(commonmark).use(history).use(listenerMarkdown(update → onChange))`；onCleanup `editor.destroy()`；`setMarkdown/getMarkdown` 经 useImperativeHandle 等价物（Solid 用 ref prop callback）暴露。
- **仅 /editor 页面 import**（动态或静态均可，但页面组件惰性加载 route）；WebUI 无该路由触发 → 构建产物可能仍含 chunk（可接受），但**运行时不 import**。

### i18n 与主题

- 扩展现有 `src/i18n/index.ts`：新增键（工作台/编辑器/保存/新建/提交/推送/AI摘要/选择博客目录/Git 等），en 空壳同步占位。
- 主题沿用 console 现有 CSS 变量体系。

### 测试

- vitest（jsdom）：bridge 降级（非 tauri 抛 require_tauri）、frontmatter core schema（date 字符串保真）、postBodyHash（物化不影响 hash）、project store（注入 fake bridge：内存文件树）、materialize 流程（mock client fetch）。
- Milkdown 不单测（thin wrapper + 手工验证）。
- 桌面页面组件测试 2-3 个（Workplace 空态/列表，mock bridge）。

## 验收（worker 必须全过并汇报）

1. 根 `pnpm install`；console：`pnpm --filter @hyacine/console typecheck/test/build` 全绿（**WebUI 构建含桌面代码后仍绿**）。
2. 根 `oxlint --type-aware --type-check .` 无 error、`oxfmt .`。
3. **cargo check + cargo build（debug）**：经仓库根 `scripts/build.bat`（内部 vcvars64 + cmd）。首编译 ~400 crate 需 5-15 分钟，属正常。若 windows-msvc 链路问题，报告具体错误，**不擅自切 gnu**。
4. （可选加分）启动 debug exe 确认进程存活数秒，随后关闭。
5. git add/commit（规范消息）并汇报：实现摘要（Rust 侧/TS 侧分列）、测试数字、cargo build 结果、与规格偏差及原因（尤其：图标生成方式、fs scope 取舍、milkdown 版本对齐、tauri 配置细节）。

## 禁止

- 禁止改 contract/api/cli 包；禁止改 console 既有非桌面路径的行为（WebUI 回归）。
- 禁止引入 OAuth、禁止云端正文存储（文件平面）、禁止在 Rust 侧写业务逻辑。
- 禁止摆弄 tauri.mobile/其他平台（v0 仅 Windows）。
- 禁止 npm 全局装 tauri CLI（用 devDep @tauri-apps/cli）。
