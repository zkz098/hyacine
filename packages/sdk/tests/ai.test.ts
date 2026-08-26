import { describe, it, expect } from "vitest";
import { cosineSimilarity, findTopSimilar, computeSimilarityMatrix } from "../src/ai/similarity";
import { chunkArticleForEmbedding, isArticleEncrypted } from "../src/ai/chunk";
import { buildStaticSearchIndex } from "../src/ai/search";
import type { PostWithAi } from "../src/types";

describe("AI Similarity", () => {
  it("computes cosine similarity accurately", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1.0);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0);
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1.0);
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });

  it("finds top similar candidates with threshold", () => {
    const target = [1, 0, 0];
    const candidates = [
      { id: "p1", vector: [1, 0, 0] }, // score = 1.0
      { id: "p2", vector: [0.9, 0.1, 0] }, // score ≈ 0.99
      { id: "p3", vector: [0.2, 0.8, 0] }, // score ≈ 0.24 (below 0.5)
      { id: "p4", vector: [0, 1, 0] }, // score = 0
    ];

    const results = findTopSimilar(target, candidates, {
      limit: 2,
      minSimilarity: 0.5,
      excludeSelf: false,
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.id).toBe("p1");
    expect(results[0]?.score).toBeCloseTo(1.0);
    expect(results[1]?.id).toBe("p2");
    expect(results[1]?.score).toBeGreaterThan(0.9);
  });

  it("computes similarity matrix across multiple posts", () => {
    const items = [
      { id: "post-a", vector: [1, 0] },
      { id: "post-b", vector: [0.95, 0.05] },
      { id: "post-c", vector: [0, 1] },
    ];

    const matrix = computeSimilarityMatrix(items, { minSimilarity: 0.8 });

    expect(matrix.get("post-a")).toBeDefined();
    expect(matrix.get("post-a")?.[0]?.id).toBe("post-b");
    expect(matrix.get("post-c")?.length).toBe(0);
  });
});

describe("AI Chunking & Encryption Guard", () => {
  it("detects encrypted content correctly", () => {
    expect(isArticleEncrypted({ encrypted: true })).toBe(true);
    expect(isArticleEncrypted({ password: "secret-123" })).toBe(true);
    expect(isArticleEncrypted({ title: "Public Post" })).toBe(false);

    const encryptedMarkdown = `---
title: Encrypted Post
encrypted: true
password: "123"
---
Secret text
`;
    expect(isArticleEncrypted(encryptedMarkdown)).toBe(true);

    const normalMarkdown = `---
title: Normal Post
date: 2026-08-26
---
Hello World
`;
    expect(isArticleEncrypted(normalMarkdown)).toBe(false);
  });

  it("blocks chunking for encrypted articles", () => {
    const raw = `---
title: Secret
encrypted: true
---
Confidential data
`;
    expect(chunkArticleForEmbedding(raw)).toEqual([]);
  });

  it("chunks markdown article by headings and length", () => {
    const raw = `---
title: Test Article
---

# Introduction
This is the intro section discussing AI architecture.

## Section 1
Here is paragraph one of section one.

## Section 2
Here is section two with more content.
`;

    const chunks = chunkArticleForEmbedding(raw, { maxChunkSize: 200 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]).toContain("Introduction");
    expect(chunks[0]).not.toContain("title: Test Article"); // Frontmatter stripped
  });
});

describe("AI Static Search Index", () => {
  it("builds clean search index without drafts", () => {
    const posts: PostWithAi[] = [
      {
        path: "src/posts/hello.md",
        slug: "hello",
        title: "Hello World",
        draft: false,
        categories: ["tech"],
        hash: "h1",
        createdAt: "2026-08-26T00:00:00Z",
        updatedAt: "2026-08-26T00:00:00Z",
        lastModified: "2026-08-26T00:00:00Z",
        content: "This is body content",
        frontmatter: { description: "Hello description" },
        ai: {
          summary: {
            summary: "AI summary of hello",
            model: "model-x",
            generatedAt: "2026-08-26",
          },
        },
        vector: [0.1, 0.2],
      },
      {
        path: "src/posts/draft.md",
        slug: "draft",
        title: "Draft Post",
        draft: true,
        categories: [],
        hash: "h2",
        createdAt: "2026-08-26T00:00:00Z",
        updatedAt: "2026-08-26T00:00:00Z",
        lastModified: "2026-08-26T00:00:00Z",
        content: "Draft content",
        frontmatter: {},
      },
    ];

    const index = buildStaticSearchIndex(posts, { includeVectors: true });
    expect(index).toHaveLength(1);
    expect(index[0]?.slug).toBe("hello");
    expect(index[0]?.summary).toBe("AI summary of hello");
    expect(index[0]?.vector).toEqual([0.1, 0.2]);
  });
});
