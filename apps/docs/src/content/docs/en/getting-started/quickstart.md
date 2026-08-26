---
title: Quickstart
description: Integrate @hyacine/sdk into your Astro 5+ blog in 5 minutes.
---

This guide walks you through integrating `@hyacine/sdk` into an existing Astro project with Content Layer.

---

## 1. Install SDK

```bash
pnpm add @hyacine/sdk
```

---

## 2. Configure Environment Variables

```ini title=".env"
HYACINE_API_URL=https://hyacine-api.your-subdomain.workers.dev
HYACINE_READ_TOKEN=hyc_tok_read_xxxxxxxxxxxxxxxx
```

---

## 3. Configure Astro Content Layer

```ts title="src/content.config.ts"
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
      topK: 5,
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
        similarPosts: z
          .array(
            z.object({
              slug: z.string(),
              similarity: z.number(),
            }),
          )
          .optional(),
      }),
  }),
};
```

---

## 4. Build Static Site

```bash
pnpm run build
```
