import type { PostWithAi, SearchIndexItem } from "../types";
import { resolveCardExcerpt } from "./excerpt";

export interface BuildSearchIndexOptions {
  includeVectors?: boolean;
  snippetLength?: number;
}

/**
 * 将文章列表及 AI 产物导出为适合静态分发的轻量级搜索索引结构。
 */
export function buildStaticSearchIndex(
  posts: PostWithAi[],
  options: BuildSearchIndexOptions = {},
): SearchIndexItem[] {
  const { includeVectors = false, snippetLength = 200 } = options;

  return posts
    .filter((post) => !post.draft)
    .map((post) => {
      const summary = post.ai?.summary?.summary ?? undefined;
      const snippet = resolveCardExcerpt(post, {
        maxLength: snippetLength,
        strategy: "description",
        fallbackToBody: true,
      });

      const item: SearchIndexItem = {
        slug: post.slug,
        title: post.title,
        path: post.path,
        categories: post.categories,
        summary,
        contentSnippet: snippet,
      };

      if (includeVectors && post.vector && post.vector.length > 0) {
        item.vector = post.vector;
      }

      return item;
    });
}
