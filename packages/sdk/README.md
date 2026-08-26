# @hyacine/sdk

Official TypeScript SDK for Hyacine & Astro Blogs.

Provides **Astro SSG Live Collections (Content Layer Loader)**, **Pre-baked AI Similarity Graph**, **AI Services**, and **Markdown Utilities** under the **Cloudflare D1 as Single Source of Truth** architecture.

## Installation

```bash
pnpm add @hyacine/sdk
```

## Quick Example (Astro 5+ / 7+ Content Collections)

```ts
// src/content.config.ts
import { defineCollection } from "astro:content";
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
  }),
};
```

## Documentation

Full documentation is available in the [`docs/`](./docs) directory:

- [Overview & Philosophy](./docs/README.md)
- [Quickstart Guide](./docs/quickstart.md)
- [Astro Live Collections Guide](./docs/astro-live-collections.md)
- [AI Services & Similarity Graph](./docs/ai-services.md)
- [API Reference](./docs/api-reference.md)
