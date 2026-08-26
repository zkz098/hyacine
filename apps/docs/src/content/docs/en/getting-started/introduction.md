---
title: Introduction
description: Overview of Hyacine, architecture, and problem space.
---

**Hyacine** is the cloud-native companion platform and content engine for [astro-blog-shokax](https://github.com/zkz098/astro-blog-shokax) and modern Astro-based blogs.

It connects edge databases (**Cloudflare D1**), object storage (**R2**), and Workers AI directly into **100% pure Static Site Generation (SSG)** workflows via Astro Content Layer Live Collections.

---

## Why Hyacine?

| Git-Only Static Blogs                         | Traditional Dynamic CMS (Ghost/Strapi) | Hyacine                              |
| :-------------------------------------------- | :------------------------------------- | :----------------------------------- |
| Requires Git commit & push for every typo fix | Heavy VPS server maintenance           | **D1 as persistent source of truth** |
| Frequent Git merge conflicts across devices   | Slow SSR cold starts                   | **100% Pure SSG Static Output**      |
| Expensive runtime client-side vector search   | Database compute overhead              | **Pre-baked AI Similarity Matrix**   |
| Offline editing is detached from cloud CMS    | No offline editing                     | **Local-First & Cloud Dual Mode**    |

---

## Monorepo Packages

```
hyacine/
├── packages/
│   ├── contract/   # Zod Schemas & typed client
│   ├── api/        # Cloudflare Worker API (Hono)
│   ├── cli/        # hyc command-line interface
│   └── sdk/        # Astro Live Collections loader & AI pre-baking
└── apps/
    ├── console/    # Solid.js management SPA
    ├── desktop/    # Tauri v2 desktop editor
    └── docs/       # Astro Starlight documentation site
```
