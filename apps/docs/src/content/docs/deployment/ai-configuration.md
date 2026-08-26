---
title: Workers AI 与 BYOK 秘钥配置
description: 配置 Cloudflare Workers AI 内置模型或切换至外部 OpenAI 兼容的大语言模型端点。
---

Hyacine 提供灵活的 AI 推理基础设施支持，支持双引擎切换：

---

## 1. 方案 A：Cloudflare Workers AI (内置开箱即用)

这是默认且零外部 API 依赖的推荐方案：

- **向量嵌入 (Embedding)**：使用 `@cf/baai/bge-m3`（1024 维，多语言支持极佳）；
- **文本摘要 (Summary)**：使用 `@cf/meta/llama-3.1-8b-instruct` 或 `@cf/qwen/qwen1.5-7b-chat`；
- **优势**：无需支付第三方大模型费用，在 Workers 内享受原生的快速本地调用。

---

## 2. 方案 B：携带自定义密钥 (BYOK - Bring Your Own Key)

如果你希望使用质量更高的大模型（如 DeepSeek-V3, GPT-4o-mini, Claude 等），可通过环境变量无缝接入任何兼容 OpenAI 协议的 API：

```bash
# 设置第三方 API Key
wrangler secret put OPENAI_API_KEY

# 设置第三方自定义端点 (例如 DeepSeek 或 Moonshot)
wrangler secret put OPENAI_BASE_URL
# 输入: https://api.deepseek.com/v1

# 指定使用的摘要生成模型名称
wrangler secret put SUMMARY_MODEL
# 输入: deepseek-chat
```

系统会优先使用配置的 `OPENAI_API_KEY` 进行摘要提取，并自动在异常时优雅回退至 Workers AI 兜底。
