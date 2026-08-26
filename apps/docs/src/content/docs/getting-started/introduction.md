---
title: 介绍 (Introduction)
description: 了解 Hyacine 的设计初衷、解决的核心问题及其技术全景。
---

**Hyacine** 是专为 [astro-blog-shokax](https://github.com/zkz098/astro-blog-shokax) 及现代 Astro 静态博客打造的云原生无头内容引擎（Headless CMS）与 AI 工具链。

它将边缘数据库（**Cloudflare D1**）、对象存储（**R2**）与边缘大模型推理（**Workers AI**）通过 Astro Content Layer 机制直接接入 **100% 纯静态网站生成（SSG）** 工作流。

---

## 为什么需要 Hyacine？

在传统的 Markdown/MDX 静态博客工作流中，博主往往面临以下痛点：

| 传统 Git 静态博客痛点                                             | 传统动态 Headless CMS (Ghost / Strapi) | Hyacine 解决方案                                            |
| :---------------------------------------------------------------- | :------------------------------------- | :---------------------------------------------------------- |
| 改一个错字都需要 `git commit && git push`                         | 需要常驻 VPS 服务器，维护成本高        | **D1 作为单一事实源**，云端快速编辑，构建时自动抓取         |
| 多设备（手机/浏览器/多台电脑）同步易产生 Git 冲突                 | SSR 渲染速度较慢，冷启动延迟明显       | **100% 纯静态 SSG 输出**，保留全球 CDN 毫秒级分发           |
| AI 摘要、向量相似文章需要在客户端实时调用 API，产生高额延迟和成本 | 强依赖服务端动态计算，数据库开销大     | **构建期预计算 (Pre-baking)**，相似度矩阵直接烘焙进 HTML    |
| 本地无网时无法编辑云端内容                                        | 离线无法使用                           | **本地/远程双模架构**，无网用本地 Git，有网一键全量上行同步 |

---

## Monorepo 子系统全景

Hyacine 采用现代 pnpm monorepo 架构，包含以下核心模块：

```
hyacine/
├── packages/
│   ├── contract/   # Zod Schemas、TS 类型定义与零依赖 API 客户端
│   ├── api/        # 基于 Hono 的 Cloudflare Worker 后端（D1/KV/R2/AI）
│   ├── cli/        # hyc 命令行工具（本地/远程双模、数据同步与脚手架）
│   └── sdk/        # Astro Live Collections Loader + 向量预计算 SDK
└── apps/
    ├── console/    # Solid.js + UnoCSS Web 云端管理控制台
    ├── desktop/    # Tauri v2 + Milkdown 本地桌面工作台
    └── docs/       # Astro Starlight 官方技术文档站
```

---

## 核心设计哲学

1. **D1 作为唯一事实源 (Persistent Source of Truth)**
   云端数据库存储博文内容与 AI 产物。Astro 仅在构建时拉取快照，确保静态构建的确定性与零运行时算力消耗。
2. **构建期拓扑计算 (Zero-Runtime Cost AI)**
   AI 摘要提取与高维向量相似度图计算均在静态构建时完成，用户访问博客时享受纯静态体验，无任何动态 API 查询延迟。
3. **隐私第一 (Privacy-First Guard)**
   对标记为加密或带有访问密码的文章，Hyacine 会在服务层严格拦截，绝不将其正文发送至任何云端 AI 接口。
4. **离线优先与自由切换 (Offline-First Dual Mode)**
   无论在 CLI 还是桌面端，开发者均可无缝在本地独立 Markdown 仓库模式与云端同步模式之间无痛切换。
