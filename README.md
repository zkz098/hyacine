# Hyacine

<div align="center">

**A cloud-native headless platform & AI toolchain for modern Astro blogs, powered by Cloudflare Workers, D1, KV, and R2.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522.12.0-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%E2%89%A511.0.0-orange.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)
[![Astro](https://img.shields.io/badge/Astro-5%2B%20%7C%207%2B-orange.svg)](https://astro.build/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers%20%7C%20D1%20%7C%20R2-F38020.svg)](https://workers.cloudflare.com/)

[Overview](#overview) •
[Features](#features) •
[Monorepo Packages](#monorepo-packages) •
[Architecture](#architecture--design-principles) •
[Quickstart](#quickstart) •
[SDK Documentation](#sdk-documentation) •
[Deployment](#deployment) •
[Contributing](#contributing)

</div>

---

## Overview

**Hyacine** is the companion platform and content engine for [astro-blog-shokax](https://github.com/zkz098/astro-blog-shokax) and modern Astro-based blogs. It bridges edge databases (Cloudflare D1), object storage (R2), and Workers AI directly into **100% pure Static Site Generation (SSG)** workflows via Astro Content Layer Live Collections.

By designating Cloudflare D1 as the single source of truth, Hyacine eliminates the friction of managing Markdown/MDX files across Git branches while preserving zero runtime compute cost, instant global CDN delivery, and AI-powered recommendations.

---

## Features

- 🚀 **SSG Live Collections (`@hyacine/sdk/astro`)**: Fetch content directly from D1 into Astro during `astro build`. Zero Git merge conflicts, zero SSR cold starts.
- 🧠 **Pre-baked AI Similarity Graph**: Automatically computes in-memory cosine similarity matrices across vector embeddings during static build, baking Top-K related articles into static HTML.
- 📝 **Intelligent Card Excerpt & Summaries**: Multi-tier fallback extraction (Frontmatter Description > AI Summary > Markdown-stripped body) fully compatible with theme card options.
- 🔒 **Privacy-First Guard**: Automatically identifies encrypted articles (`encrypted: true` / `password`), strictly blocking sensitive content from external AI endpoints.
- 🖥️ **Multi-Surface Editing**:
  - **Tauri Desktop Workbench (`apps/desktop`)**: Local-first Milkdown WYSIWYG editor with offline Git operations and cloud sync.
  - **Web Management Console (`apps/console`)**: Solid.js SPA for dashboard analytics, token management, asset uploads, and AI status.
  - **CLI (`packages/cli`)**: Unified `hyc` command-line companion for local and remote operations.
- ⚡ **R2 S3-Compatible Asset Pipeline**: Direct client-to-R2 uploads via SigV4 presigned URLs; workers sign without touching file bytes.
- 🔑 **Bring Your Own Key (BYOK)**: User-provided OpenAI-compatible endpoints or Cloudflare Workers AI with secrets held at worker deployment level.

---

## Monorepo Packages

| Package / App                              | Description                                                                            | Runtime / Tech                        |
| :----------------------------------------- | :------------------------------------------------------------------------------------- | :------------------------------------ |
| [`packages/sdk`](./packages/sdk)           | TypeScript SDK for Astro Live Collections, similarity graph pre-baking, and AI helpers | Universal TS (Node / Browser / Astro) |
| [`packages/contract`](./packages/contract) | Zod schemas, inferred types, and typed API client (single contract truth)              | Pure TS (Zero dependency)             |
| [`packages/api`](./packages/api)           | Cloudflare Worker (Hono): Auth, D1 CRUD, Workers AI embeddings, R2 presign             | Cloudflare `workerd`                  |
| [`packages/cli`](./packages/cli)           | `hyc` command-line interface: local/remote mode, D1 sync, and project bootstrap        | Node.js ≥ 22                          |
| [`apps/console`](./apps/console)           | Web management dashboard SPA (posts, assets, tokens, AI queue, settings)               | Solid.js + UnoCSS + Vite              |
| [`apps/desktop`](./apps/desktop)           | Desktop workbench (Milkdown editor, local git, dual-mode workspace)                    | Tauri v2 + Solid.js (MSVC on Windows) |

---

## Architecture & Design Principles

```
                       ┌───────────────────────────────┐
                       │   Hyacine Desktop / Console   │
                       └───────────────┬───────────────┘
                                       │ Edit & Save
                                       ▼
                       ┌───────────────────────────────┐
                       │    Cloudflare Worker (API)    │
                       ├───────────────────────────────┤
                       │  • D1 (Posts & AI Results)    │
                       │  • Workers AI / BYOK Summary  │
                       │  • R2 (Presigned Assets)      │
                       └───────────────┬───────────────┘
                                       │ Deploy Webhook
                                       ▼
                       ┌───────────────────────────────┐
                       │  Astro SSG Build Pipeline     │
                       ├───────────────────────────────┤
                       │  hyacineLoader (@hyacine/sdk) │
                       │   ├── Batch Pull from D1      │
                       │   ├── Pre-bake Similar Graph  │
                       │   └── Astro DataStore Digest  │
                       └───────────────┬───────────────┘
                                       ▼
                       ┌───────────────────────────────┐
                       │  100% Pure Static Output      │
                       │  (Cloudflare Pages / GitHub)  │
                       └───────────────────────────────┘
```

1. **D1 as the Persistent Source of Truth**: Content and metadata reside in Cloudflare D1. Astro pulls snapshots during SSG build, guaranteeing build determinism without requiring Git commits for every typo fix.
2. **Offline-Friendly Fallback**: The CLI and Desktop shell provide a strict dual-mode boundary: unauthenticated local mode for pure file/git editing, and remote mode for cloud sync and AI capabilities.
3. **Stateless Edge Execution**: The API Worker maintains no state in memory, offloading data to D1, cache to KV, and binary blobs to R2.

---

## Quickstart

### 1. Prerequisites

- [Node.js](https://nodejs.org/) $\ge$ 22.12.0
- [pnpm](https://pnpm.io/) $\ge$ 11.0.0
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (for Cloudflare Workers deployment)

### 2. Monorepo Setup

```bash
# Clone the repository
git clone https://github.com/zkz098/hyacine.git
cd hyacine

# Install dependencies
pnpm install

# Run comprehensive workspace check (lint, format, typecheck, test)
pnpm run check
```

### 3. Using `@hyacine/sdk` in an Astro Project

Install the SDK in your Astro site:

```bash
pnpm add @hyacine/sdk
```

Configure `src/content.config.ts`:

```ts
import { defineCollection, z } from "astro:content";
import { hyacineLoader } from "@hyacine/sdk/astro";

export const collections = {
  posts: defineCollection({
    loader: hyacineLoader({
      apiUrl: import.meta.env.HYACINE_API_URL,
      token: import.meta.env.HYACINE_READ_TOKEN,
      prefix: "src/posts",
      withAiMetadata: true,
      calculateSimilarGraph: true,
    }),
    schema: ({ image }) =>
      z.object({
        title: z.string(),
        date: z.coerce.date(),
        tags: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
        cover: z.union([image(), z.string()]).optional(),
        ai: z
          .object({
            summary: z.object({ summary: z.string().nullable() }).optional(),
          })
          .optional(),
        similarPosts: z.array(z.any()).optional(),
      }),
  }),
};
```

Run standard Astro static build:

```bash
pnpm run build
```

---

## SDK Documentation

Detailed documentation for `@hyacine/sdk` is available under [`packages/sdk/docs/`](./packages/sdk/docs/):

- 📘 [SDK Overview & Architecture](./packages/sdk/docs/README.md)
- 🚀 [Quickstart Guide](./packages/sdk/docs/quickstart.md)
- 🧩 [Astro Live Collections Guide](./packages/sdk/docs/astro-live-collections.md)
- 🤖 [AI Services & Similarity Graph Guide](./packages/sdk/docs/ai-services.md)
- 📖 [Complete API Reference](./packages/sdk/docs/api-reference.md)

---

## Deployment

Refer to [`DEPLOY.md`](./DEPLOY.md) for step-by-step instructions on:

- Setting up Cloudflare D1 database migrations
- Configuring Workers AI and BYOK OpenAI-compatible secrets
- Deploying the API Worker to Cloudflare
- Setting up CI/CD workflows for automatic Astro static deployments

---

## Scripts & Development

```bash
pnpm run typecheck     # Run TypeScript typecheck across all packages
pnpm run test          # Run Vitest unit test suite (240+ tests)
pnpm run lint          # Run Oxlint checks
pnpm run format        # Run Oxfmt code formatting
pnpm run check         # Run lint, format, typecheck, and test in sequence
```

---

## License

This project is licensed under the [MIT License](./LICENSE).
