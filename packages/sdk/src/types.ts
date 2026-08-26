import type { PostListItem } from "@hyacine/contract";

export interface HyacineSdkOptions {
  apiUrl: string;
  token?: string;
  fetch?: typeof fetch;
}

export interface AiSummaryMetadata {
  summary: string | null;
  model: string | null;
  generatedAt: string | null;
}

export interface AiEmbedMetadata {
  present: boolean;
  model: string | null;
  generatedAt: string | null;
}

export interface SimilarPostItem {
  slug: string;
  title: string;
  score: number;
  path: string;
  cover?: string;
  category?: string;
  date?: string;
}

export interface PostWithAi {
  path: string;
  slug: string;
  title: string;
  draft: boolean;
  categories: string[];
  hash: string;
  createdAt: string;
  updatedAt: string;
  lastModified: string;
  content: string;
  frontmatter: Record<string, unknown>;
  ai?: {
    summary?: AiSummaryMetadata;
    embed?: AiEmbedMetadata;
    similarPosts?: SimilarPostItem[];
  };
  vector?: number[] | null;
}

export type ExcerptStrategy = "ai" | "description" | "auto" | "default";

export interface CardExcerptOptions {
  maxLength?: number;
  strategy?: ExcerptStrategy;
  fallbackToBody?: boolean;
}

export interface SimilarityOptions {
  limit?: number;
  minSimilarity?: number;
  excludeSelf?: boolean;
}

export interface ChunkOptions {
  maxChunkSize?: number;
  overlap?: number;
}

export interface SearchIndexItem {
  slug: string;
  title: string;
  path: string;
  categories: string[];
  summary?: string;
  contentSnippet: string;
  vector?: number[];
}
