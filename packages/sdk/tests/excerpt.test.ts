import { describe, it, expect } from "vitest";
import { stripMarkdown, resolveCardExcerpt } from "../src/ai/excerpt";

describe("stripMarkdown", () => {
  it("strips frontmatter, html, codeblocks, directives, and formatting symbols", () => {
    const markdown = `---
title: Test
date: 2026-08-26
---
# Main Title
This is **bold** and *italic* and \`inline code\`.

\`\`\`ts
const x = 100;
\`\`\`

:::note
This is a Shokax custom note container.
:::

Check [Google](https://google.com) and ![Cover](/img/a.jpg).
<!-- comment -->
<div class="test">HTML content</div>
`;

    const cleaned = stripMarkdown(markdown);
    expect(cleaned).not.toContain("title: Test");
    expect(cleaned).not.toContain("const x = 100");
    expect(cleaned).not.toContain(":::note");
    expect(cleaned).not.toContain("<div");
    expect(cleaned).not.toContain("<!-- comment -->");
    expect(cleaned).not.toContain("`");
    expect(cleaned).not.toContain("*");
    expect(cleaned).toContain("Main Title");
    expect(cleaned).toContain("This is bold and italic and inline code");
    expect(cleaned).toContain("Check Google and");
  });
});

describe("resolveCardExcerpt", () => {
  const samplePost = {
    body: "This is the full markdown body content for the blog post.",
    description: "Manual description in frontmatter",
    ai: {
      summary: {
        summary: "AI generated concise summary",
      },
    },
  };

  it("prioritizes AI summary when strategy is 'ai'", () => {
    const excerpt = resolveCardExcerpt(samplePost, { strategy: "ai" });
    expect(excerpt).toBe("AI generated concise summary");
  });

  it("prioritizes description when strategy is 'description'", () => {
    const excerpt = resolveCardExcerpt(samplePost, { strategy: "description" });
    expect(excerpt).toBe("Manual description in frontmatter");
  });

  it("falls back to description if AI summary is missing under 'ai' strategy", () => {
    const postWithoutAi = {
      description: "Manual description only",
      body: "Body text",
    };
    const excerpt = resolveCardExcerpt(postWithoutAi, { strategy: "ai" });
    expect(excerpt).toBe("Manual description only");
  });

  it("falls back to body when no description or AI summary exists", () => {
    const postBodyOnly = {
      body: "## Introduction\nRaw body text with # Markdown tags.",
    };
    const excerpt = resolveCardExcerpt(postBodyOnly, { strategy: "auto" });
    expect(excerpt).toBe("Introduction Raw body text with Markdown tags.");
  });

  it("truncates long excerpts with ellipsis", () => {
    const longPost = {
      description: "A".repeat(200),
    };
    const excerpt = resolveCardExcerpt(longPost, { maxLength: 50 });
    expect(excerpt.length).toBeLessThanOrEqual(53);
    expect(excerpt.endsWith("...")).toBe(true);
  });
});
