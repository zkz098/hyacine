---
title: 贡献指南 (Contributing)
description: 参与 Hyacine 开发、Monorepo 工具链使用与版本发布流程。
---

感谢你对 Hyacine 的关注与支持！欢迎为项目贡献代码、文档或反馈 Issue。

---

## 1. 本地开发环境准备

Hyacine 使用现代极速工具链：

- **Node.js**：≥ 24.0.0
- **pnpm**：≥ 11.0.0
- **Linter & Formatter**：[Oxlint](https://oxc.rs/) 与 [Oxfmt](https://oxc.rs/)
- **编译器/打包器**：`tsdown` (基于 Rolldown / esbuild)

### 安装与质量检查

```bash
# 克隆仓库
git clone https://github.com/zkz098/hyacine.git
cd hyacine

# 安装所有子包依赖
pnpm install

# 运行全套质量门禁检查 (Lint + Format + Typecheck + Test)
pnpm run check
```

---

## 2. 变更日志与发布规范

Hyacine 使用 **Changesets** 管理多包版本与发版：

```bash
# 提交代码前创建变更集
pnpm changeset
```

根据 CLI 交互式提示选择修改的包级别（patch / minor / major），并填写简要变更说明。合并至 `main` 分支后，GitHub Actions 将自动创建版本合并 PR 并通过 npm OIDC Trusted Publishing 自动发布。
