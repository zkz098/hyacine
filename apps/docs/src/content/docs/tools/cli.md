---
title: hyc 命令行 (CLI)
description: "@hyacine/cli 核心架构、本地/远程双模机制与常用命令参考。"
---

`hyc` 是 Hyacine 的统一命令行交互工具（基于 Node.js ≥ 22），提供对本地博文的管理、AI 摘要物化、云端增量同步与全量打包能力。

---

## 1. 安装与初始化

在项目中使用或全局安装：

```bash
# 全局安装
pnpm add -g @hyacine/cli

# 或在项目内通过 npx / pnpm dlx 临时调用
pnpm dlx hyc --help
```

在博客项目根目录初始化：

```bash
hyc init
```

执行后会交互式生成 `hyacine.yml` 配置文件：

```yaml title="hyacine.yml"
contentDir: src/posts
assetsDir: src/assets
postExtension:
  - .md
  - .mdx
```

---

## 2. 严格两态机制 (Local vs Remote)

`hyc` 采用严格清晰的运行模式边界：

| 模式                       | 判定条件                               | 适用场景                                     |
| :------------------------- | :------------------------------------- | :------------------------------------------- |
| **本地模式 (Local Mode)**  | 未配置 `api.url` 或指定 `--local` 参数 | 纯本地文件系统操作，无本地数据库，不依赖网络 |
| **远程模式 (Remote Mode)** | 已通过 `hyc login` 登录云端 API        | 云端 D1 差异同步、AI 摘要队列管理、用量统计  |

---

## 3. 常用命令清单

### 本地管理命令 (无网络要求)

- `hyc new <title>`：创建新文章，支持交互式选择分类、标签与模板。
- `hyc list`：展示本地博文列表、发布状态与字数统计。
- `hyc edit <slug>`：在系统默认编辑器中打开指定文章。
- `hyc rename <old-slug> <new-slug>`：安全重命名文章及关联资产。
- `hyc backup`：将本地博文与资产归档打包为 `.tar.gz` 备份。

### 远程与 AI 命令 (需登录 API)

- `hyc login`：交互式配置 Worker API 地址与 Token。
- `hyc sync`：计算本地文章与云端 D1 的 hash diff，执行增量上行同步。
- `hyc ai:summary`：批量触发 AI 摘要生成，并支持将摘要物化写回本地 Markdown frontmatter。
- `hyc stats`：查询云端 D1 数据库容量、AI 接口调用次数与 Token 用量。
