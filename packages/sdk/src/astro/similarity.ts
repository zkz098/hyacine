import { cosineSimilarity } from "../ai/similarity";
import type { PostWithAi, SimilarPostItem, SimilarityOptions } from "../types";

/**
 * 在 SSG 构建阶段，内存计算全站已发布文章之间的余弦相似度图谱。
 * 为每篇文章生成 Top-K 相似文章列表，直接注入数据层。
 */
export function computeGlobalSimilarity(
  posts: PostWithAi[],
  options: SimilarityOptions = {},
): Map<string, SimilarPostItem[]> {
  const { limit = 5, minSimilarity = 0.4 } = options;
  const resultMap = new Map<string, SimilarPostItem[]>();

  // 1. 过滤有效候选文章（非草稿、含向量）
  const validPosts = posts.filter((p) => !p.draft && p.vector && p.vector.length > 0);

  for (let i = 0; i < validPosts.length; i++) {
    const current = validPosts[i];
    if (!current || !current.vector) continue;

    const matchedItems: SimilarPostItem[] = [];

    for (let j = 0; j < validPosts.length; j++) {
      if (i === j) continue;
      const target = validPosts[j];
      if (!target || !target.vector) continue;

      const score = cosineSimilarity(current.vector, target.vector);
      if (score >= minSimilarity) {
        const cover =
          typeof target.frontmatter?.cover === "string" ? target.frontmatter.cover : undefined;
        const date =
          typeof target.frontmatter?.date === "string" ? target.frontmatter.date : target.createdAt;

        matchedItems.push({
          slug: target.slug,
          title: target.title,
          path: target.path,
          score,
          category: target.categories[0],
          cover,
          date,
        });
      }
    }

    matchedItems.sort((a, b) => b.score - a.score);
    resultMap.set(current.slug, matchedItems.slice(0, limit));
  }

  return resultMap;
}
