---
title: CLI 命令全量参考 (CLI Reference)
description: hyc 命令行全部参数、选项、全局 flags 与环境变量完整速查。
---

## 1. 全局选项 (Global Options)

所有 `hyc` 子命令均支持以下全局选项：

| 选项              | 简写 | 说明                                               |
| :---------------- | :--- | :------------------------------------------------- |
| `--help`          | `-h` | 显示命令帮助信息与参数说明                         |
| `--version`       | `-v` | 输出当前 `hyc` 版本号                              |
| `--local`         |      | 强制以本地模式运行，即使已配置云端 API             |
| `--config <path>` | `-c` | 指定自定义 `hyacine.yml` 路径                      |
| `--json`          |      | 以结构化 JSON 格式输出执行结果（便于脚本管道集成） |

---

## 2. 环境变量 (Environment Variables)

| 环境变量            | 默认值  | 说明                            |
| :------------------ | :------ | :------------------------------ |
| `HYACINE_API_URL`   | 无      | 覆盖配置中的 Worker API 地址    |
| `HYACINE_API_TOKEN` | 无      | 覆盖登录保存的 API Token        |
| `HYACINE_LANG`      | `zh-cn` | 命令行输出语言 (`zh-cn` / `en`) |
| `NO_COLOR`          | 无      | 禁用 ANSI 终端彩色高亮输出      |

---

## 3. 子命令详情

### `hyc init`

初始化当前目录为 Hyacine 博客工程。

- `--force`：覆盖已存在的 `hyacine.yml` 配置文件。

### `hyc new <title>`

在 `contentDir` 下交互式创建新文章。

- `--slug <slug>`：指定文章的唯一标识符。
- `--tags <tags...>`：为文章预设标签列表。
- `--category <cat>`：为文章指定主分类。

### `hyc sync`

将本地修改同步至云端 D1 数据库。

- `--dry-run`：仅输出变更差异分析，不实际执行网络写入。
- `--force`：强制覆盖云端冲突。

### `hyc ai:summary`

批量提取/生成未处理博文的 AI 摘要。

- `--write-back` / `-w`：自动将 AI 提取的摘要物化写回本地 Markdown frontmatter 中的 `ai.summary` 字段。
- `--concurrency <num>`：并发生成任务数（默认 3）。
