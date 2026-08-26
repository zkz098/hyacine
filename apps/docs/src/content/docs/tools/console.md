---
title: Web 管理控制台 (Console)
description: 基于 Solid.js + UnoCSS + Vite 构建的轻量 Web 端内容与云资源管理仪表盘。
---

Hyacine Console (`apps/console`) 是部署在云端（如 Cloudflare Pages）的 Web 管理控制台，方便博主在任何浏览器端管理博文、监控 AI 队列及分配访问 Token。

---

## 1. 核心功能模块

- 📊 **仪表盘 (Dashboard)**：全站博文总量、已生成 AI 向量覆盖率、D1 存储容量与 Workers AI 配额用量监控；
- 📄 **文章管理 (Posts)**：查看、搜索、筛选云端 D1 中的博文，支持在线查看 Markdown 源码与 AI 摘要状态；
- 🤖 **AI 任务队列 (AI Queue)**：查看后台异步生成的摘要与 BGE-M3 向量嵌入进度，支持一键批量重算；
- 🔑 **Token 管理 (Tokens)**：
  - 生成用于 CI 构建的只读 Token (`read`)；
  - 生成用于 CLI / 桌面端同步的读写管理员 Token (`admin`)；
  - 查看 Token 访问日志与失效撤销；
- 🖼️ **对象存储资产库 (Assets)**：直连 Cloudflare R2 存储桶，管理上传的媒体文件、图片并获取 CDN 直链。

---

## 2. 独立部署与本地运行

Console 是纯静态 Solid.js SPA 应用，零 SSR 服务端依赖：

```bash
# 启动本地开发服务 (默认端口 5173 / 5199)
pnpm --filter @hyacine/console dev

# 编译为纯静态产物 (输出至 apps/console/dist)
pnpm --filter @hyacine/console build
```

可一键部署至 Cloudflare Pages，并在初始化界面填入 Worker API 地址与安装码（`SETUP_CODE`）完成初次绑定。
