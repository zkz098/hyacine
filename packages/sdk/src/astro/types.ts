import type { SimilarityOptions } from "../types";

/**
 * Astro 5+ / 7+ Content Layer Loader 上下文接口（松耦合定义，避免强依赖 astro 核心包）
 */
export interface AstroDataStoreEntry {
  id: string;
  data: Record<string, unknown>;
  body?: string;
  filePath?: string;
  digest?: string | number;
  rendered?: {
    html: string;
    metadata?: Record<string, unknown>;
  };
}

export interface AstroDataStore {
  get(id: string): AstroDataStoreEntry | undefined;
  set(entry: AstroDataStoreEntry): void;
  has(id: string): boolean;
  delete(id: string): void;
  clear(): void;
  keys(): IterableIterator<string> | string[];
  values(): IterableIterator<AstroDataStoreEntry> | AstroDataStoreEntry[];
  entries(): IterableIterator<[string, AstroDataStoreEntry]> | [string, AstroDataStoreEntry][];
}

export interface AstroLoaderContext {
  store: AstroDataStore;
  meta: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
  };
  logger: {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    debug(message: string): void;
  };
  parseData: (params: {
    id: string;
    data: Record<string, unknown>;
  }) => Promise<Record<string, unknown>>;
  generateDigest: (data: unknown) => string;
}

export interface AstroLoader {
  name: string;
  load: (context: AstroLoaderContext) => Promise<void>;
  schema?: unknown;
}

export interface HyacineLoaderOptions {
  /**
   * Hyacine Cloudflare Worker API 根地址（如 https://api.hyacine.example.com）
   */
  apiUrl: string;

  /**
   * 只读 Token（具有 posts.r 权限），SSG 构建在 CI 中读取
   */
  token?: string;

  /**
   * 集合前缀过滤（如 "src/posts" 或 "src/moments"）
   */
  prefix?: string;

  /**
   * 是否自动合并并注入 AI 产物（摘要、生成时间、模型信息），默认 true
   */
  withAiMetadata?: boolean;

  /**
   * 是否在构建期预计算全站文章的相近推荐文章列表（similarPosts），默认 true
   */
  calculateSimilarGraph?: boolean;

  /**
   * 相似度图谱计算参数（阈值与最大推荐条数）
   */
  similarOptions?: SimilarityOptions;

  /**
   * 自定义 fetch 实例（用于单元测试或特殊代理）
   */
  customFetch?: typeof fetch;
}
