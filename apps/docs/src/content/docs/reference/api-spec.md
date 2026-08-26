---
title: REST API 规范 (API Reference)
description: Cloudflare Worker (hyacine-api) 完整 RESTful 端点规范、请求参数与响应模型。
---

Hyacine API 基于 Hono 构建，所有接口响应均遵循统一的 JSON 格式封装。

---

## 1. 基础约定

- **基础路径**：`/api/*`
- **鉴权 Header**：`Authorization: Bearer <token>`
- **Token 权限等级**：
  - `read`：只读权限（获取文章列表、单篇详情、统计指标）；
  - `admin`：完整读写权限（同步文章、触发 AI、管理 Token、删除资源）。

### 统一响应结构

```json
{
  "ok": true,
  "data": { ... }
}
```

错误响应：

```json
{
  "ok": false,
  "error": {
    "code": "unauthorized",
    "message": "Token is invalid or expired"
  }
}
```

---

## 2. 端点清单 (Endpoints)

### 认证与初始化 (`/api/auth`)

| 方法   | 路径               | 权限           | 说明                                                  |
| :----- | :----------------- | :------------- | :---------------------------------------------------- |
| `POST` | `/api/auth/setup`  | 公开           | 使用 `SETUP_CODE` 完成首次部署初始化并获得 root token |
| `POST` | `/api/auth/verify` | 任意有效 Token | 验证当前 Token 有效性与权限等级                       |

### 博文管理 (`/api/posts`)

| 方法     | 路径               | 权限    | 说明                                                   |
| :------- | :----------------- | :------ | :----------------------------------------------------- |
| `GET`    | `/api/posts`       | `read`  | 分页获取博文列表，支持 `tag`, `category`, `draft` 过滤 |
| `GET`    | `/api/posts/:slug` | `read`  | 获取单篇博文完整内容、Frontmatter 与 AI 摘要           |
| `POST`   | `/api/posts`       | `admin` | 创建或更新博文（按 slug 自动判断 upsert）              |
| `DELETE` | `/api/posts/:slug` | `admin` | 删除指定博文及其在 D1 中的索引和 AI 向量               |

### 同步服务 (`/api/sync`)

| 方法   | 路径        | 权限    | 说明                                               |
| :----- | :---------- | :------ | :------------------------------------------------- |
| `POST` | `/api/sync` | `admin` | 接收本地博文快照列表，比对 hash 差异并返回变更清单 |

### AI 智能服务 (`/api/ai`)

| 方法   | 路径                    | 权限    | 说明                                       |
| :----- | :---------------------- | :------ | :----------------------------------------- |
| `POST` | `/api/ai/summary/:slug` | `admin` | 手动触发单篇文章的 AI 摘要生成             |
| `POST` | `/api/ai/embed/:slug`   | `admin` | 手动触发单篇文章的 BGE-M3 向量嵌入计算     |
| `GET`  | `/api/ai/status`        | `read`  | 查询当前全站向量生成覆盖率与未处理队列数量 |

### 资产直传 (`/api/assets`)

| 方法   | 路径                  | 权限    | 说明                                                  |
| :----- | :-------------------- | :------ | :---------------------------------------------------- |
| `POST` | `/api/assets/presign` | `admin` | 请求生成 Cloudflare R2 S3 兼容的 SigV4 预签名上传 URL |

### 令牌管理 (`/api/tokens`)

| 方法     | 路径              | 权限    | 说明                                                |
| :------- | :---------------- | :------ | :-------------------------------------------------- |
| `GET`    | `/api/tokens`     | `admin` | 获取所有有效 API Token 列表及权限                   |
| `POST`   | `/api/tokens`     | `admin` | 创建新 Token（指定 `read` 或 `admin` 角色与备注名） |
| `DELETE` | `/api/tokens/:id` | `admin` | 撤销并删除指定 Token                                |

### 统计指标 (`/api/stats`)

| 方法  | 路径         | 权限   | 说明                                                  |
| :---- | :----------- | :----- | :---------------------------------------------------- |
| `GET` | `/api/stats` | `read` | 获取文章总数、分类分布、D1 存储行数与 AI 调用频次统计 |
