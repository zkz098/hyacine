import {
  HyacineClient,
  type SummaryResponse,
  type EmbedResponse,
  type SimilarItem,
  type AiStatusEntry,
} from "@hyacine/contract";
import type { HyacineSdkOptions, SimilarityOptions } from "../types";
import { chunkArticleForEmbedding, isArticleEncrypted } from "./chunk";

export class HyacineAiClient {
  readonly #client: HyacineClient;

  constructor(options: HyacineSdkOptions) {
    this.#client = new HyacineClient({
      baseUrl: options.apiUrl,
      token: options.token,
      fetch: options.fetch,
    });
  }

  get rawClient(): HyacineClient {
    return this.#client;
  }

  /**
   * 获取单篇文章的摘要。若服务端存在缓存直接返回，否则如传递了 content 则调用 BYOK 端点生成。
   */
  async getPostSummary(params: {
    hash: string;
    content?: string;
    model?: string;
  }): Promise<SummaryResponse | null> {
    if (!params.content) {
      const statusRes = await this.#client.aiStatus({ hashes: [params.hash] });
      const entry = statusRes.entries[0];
      if (entry?.summary.present && entry.summary.model) {
        // Status only provides metadata; for full summary body call aiSummary with content if available
      }
    }

    if (params.content) {
      if (isArticleEncrypted(params.content)) {
        return null;
      }
      return this.#client.aiSummary({
        hash: params.hash,
        content: params.content,
        model: params.model,
      });
    }

    return null;
  }

  /**
   * 查询与指定文章 Hash 相似的已发布文章列表。
   */
  async getSimilarPosts(hash: string, options: SimilarityOptions = {}): Promise<SimilarItem[]> {
    const { limit = 5, minSimilarity = 0.4 } = options;
    const res = await this.#client.aiSimilar({ hash, limit });
    return res.items.filter((item) => item.score >= minSimilarity);
  }

  /**
   * 为文章生成向量嵌入（自动进行客户端切分并上传 chunks）。
   */
  async generateEmbeddings(params: {
    hash: string;
    content: string;
    model?: string;
    maxChunkSize?: number;
  }): Promise<EmbedResponse | null> {
    if (isArticleEncrypted(params.content)) {
      return null;
    }

    const chunks = chunkArticleForEmbedding(params.content, {
      maxChunkSize: params.maxChunkSize ?? 800,
    });

    if (chunks.length === 0) {
      return null;
    }

    return this.#client.aiEmbed({
      hash: params.hash,
      chunks,
      model: params.model,
    });
  }

  /**
   * 批量查询多个文章 Hash 的 AI 状态。
   */
  async getAiStatus(hashes: string[]): Promise<AiStatusEntry[]> {
    if (hashes.length === 0) return [];
    const res = await this.#client.aiStatus({ hashes });
    return res.entries;
  }

  /**
   * 触发服务端生成指定文章的 AI 产物（摘要 / 向量）。
   */
  async triggerGeneration(path: string, kinds: ("summary" | "embed")[] = ["summary", "embed"]) {
    return this.#client.generateAi({ path, kinds });
  }
}
