import type { SimilarityOptions } from "../types";

/**
 * 计算两个浮点向量的余弦相似度（[-1, 1]），处理零向量或维度不匹配情况。
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const valA = a[i] ?? 0;
    const valB = b[i] ?? 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(-1, Math.min(1, similarity));
}

export interface VectorEntry<T = string> {
  id: T;
  vector: number[];
}

export interface SimilarityResult<T = string> {
  id: T;
  score: number;
}

/**
 * 针对目标向量，从候选中找出 Top-K 最相似项。
 */
export function findTopSimilar<T = string>(
  targetVector: number[],
  candidates: VectorEntry<T>[],
  options: SimilarityOptions = {},
): SimilarityResult<T>[] {
  const { limit = 5, minSimilarity = 0.4, excludeSelf = true } = options;

  const results: SimilarityResult<T>[] = [];

  for (const candidate of candidates) {
    if (excludeSelf && targetVector === candidate.vector) {
      continue;
    }

    const score = cosineSimilarity(targetVector, candidate.vector);
    if (score >= minSimilarity) {
      results.push({ id: candidate.id, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * 批量计算全量候选项之间的相似度邻接表（构建期内存执行，O(N^2) 精简矩阵）。
 */
export function computeSimilarityMatrix<T = string>(
  items: VectorEntry<T>[],
  options: SimilarityOptions = {},
): Map<T, SimilarityResult<T>[]> {
  const { limit = 5, minSimilarity = 0.4 } = options;
  const matrix = new Map<T, SimilarityResult<T>[]>();

  for (let i = 0; i < items.length; i++) {
    const itemA = items[i];
    if (!itemA || !itemA.vector || itemA.vector.length === 0) continue;

    const neighbors: SimilarityResult<T>[] = [];

    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const itemB = items[j];
      if (!itemB || !itemB.vector || itemB.vector.length === 0) continue;

      const score = cosineSimilarity(itemA.vector, itemB.vector);
      if (score >= minSimilarity) {
        neighbors.push({ id: itemB.id, score });
      }
    }

    neighbors.sort((a, b) => b.score - a.score);
    matrix.set(itemA.id, neighbors.slice(0, limit));
  }

  return matrix;
}
