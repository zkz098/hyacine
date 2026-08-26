import matter from "gray-matter";
import { HyacineClient } from "@hyacine/contract";
import type { AstroLoader, AstroLoaderContext, HyacineLoaderOptions } from "./types";
import type { PostWithAi } from "../types";
import { computeGlobalSimilarity } from "./similarity";

function cleanSlug(path: string, explicitSlug?: unknown): string {
  if (typeof explicitSlug === "string" && explicitSlug.trim().length > 0) {
    return explicitSlug.trim();
  }
  return path
    .replace(/^src\/(posts|moments)\//, "")
    .replace(/\.(md|mdx)$/, "")
    .replace(/\\/g, "/");
}

/**
 * Astro 5+ / 7+ 专用的 Hyacine D1 远程内容加载器（Live Collections Loader）。
 * 在 SSG 构建阶段自动从 D1 提取数据、解析 Frontmatter、预注入 AI 产物与相似图谱。
 */
export function hyacineLoader(options: HyacineLoaderOptions): AstroLoader {
  return {
    name: "hyacine-d1-loader",
    load: async (context: AstroLoaderContext): Promise<void> => {
      const { store, logger, parseData, generateDigest } = context;

      logger.info(
        `[hyacine-loader] 连接 D1 节点: ${options.apiUrl} (prefix: ${options.prefix ?? "全量"})`,
      );

      const client = new HyacineClient({
        baseUrl: options.apiUrl,
        token: options.token,
        fetch: options.customFetch,
      });

      // 1. 获取 D1 全量文章内容快照
      let snapshot: { generatedAt: string; posts: Array<{ path: string; content: string }> };
      try {
        snapshot = await client.exportSnapshot();
      } catch (error) {
        logger.error(`[hyacine-loader] 拉取 D1 快照失败: ${String(error)}`);
        throw error;
      }

      // 2. 获取文章索引与 AI 状态
      let postIndexMap = new Map<string, unknown>();
      if (options.withAiMetadata !== false) {
        try {
          const indexRes = await client.postsList();
          for (const item of indexRes.posts) {
            postIndexMap.set(item.path, item);
          }
        } catch (err) {
          logger.warn(
            `[hyacine-loader] 获取文章 AI 索引元数据失败（降级读取 Frontmatter）: ${String(err)}`,
          );
        }
      }

      // 3. 前缀过滤（如 prefix = "src/posts"）
      const filteredPosts = options.prefix
        ? snapshot.posts.filter(
            (p) =>
              p.path === options.prefix ||
              p.path.startsWith(
                options.prefix!.endsWith("/") ? options.prefix! : `${options.prefix}/`,
              ),
          )
        : snapshot.posts;

      logger.info(`[hyacine-loader] 命中 ${filteredPosts.length} 篇 D1 文章，开始处理...`);

      // 4. 解析 Markdown 与 Frontmatter
      const parsedPosts: PostWithAi[] = [];

      for (const rawItem of filteredPosts) {
        try {
          const { data: frontmatter, content: body } = matter(rawItem.content);
          const slug = cleanSlug(rawItem.path, frontmatter.slug);
          const title = (frontmatter.title as string) || slug;
          const draft = Boolean(frontmatter.draft);
          const categories = Array.isArray(frontmatter.categories)
            ? (frontmatter.categories as string[])
            : [];

          const indexed = postIndexMap.get(rawItem.path) as
            | {
                hash?: string;
                createdAt?: string;
                updatedAt?: string;
                lastModified?: string;
                ai?: {
                  summary?: { present?: boolean; model?: string | null; at?: string | null };
                  embed?: { present?: boolean; model?: string | null; at?: string | null };
                };
              }
            | undefined;

          // 提取 AI 摘要（优先 Frontmatter 中的物化值，其次为云端状态）
          const aiSummary =
            typeof frontmatter.ai_summary === "string"
              ? frontmatter.ai_summary
              : (frontmatter.summary as string) || null;

          const aiModel =
            typeof frontmatter.ai_model === "string"
              ? frontmatter.ai_model
              : (indexed?.ai?.summary?.model ?? null);

          parsedPosts.push({
            path: rawItem.path,
            slug,
            title,
            draft,
            categories,
            hash: indexed?.hash || generateDigest(rawItem.content),
            createdAt:
              typeof frontmatter.date === "string"
                ? frontmatter.date
                : frontmatter.date instanceof Date
                  ? frontmatter.date.toISOString()
                  : indexed?.createdAt || new Date().toISOString(),
            updatedAt:
              typeof frontmatter.updated === "string"
                ? frontmatter.updated
                : frontmatter.updated instanceof Date
                  ? frontmatter.updated.toISOString()
                  : indexed?.updatedAt || new Date().toISOString(),
            lastModified: indexed?.lastModified || new Date().toISOString(),
            content: body,
            frontmatter,
            ai: {
              summary: {
                summary: aiSummary,
                model: aiModel,
                generatedAt: indexed?.ai?.summary?.at ?? null,
              },
              embed: {
                present: Boolean(indexed?.ai?.embed?.present),
                model: indexed?.ai?.embed?.model ?? null,
                generatedAt: indexed?.ai?.embed?.at ?? null,
              },
            },
          });
        } catch (err) {
          logger.warn(`[hyacine-loader] 解析文章 ${rawItem.path} 失败: ${String(err)}`);
        }
      }

      // 5. 构建期预计算全局相似文章推荐表
      const similarityMap =
        options.calculateSimilarGraph !== false
          ? computeGlobalSimilarity(parsedPosts, options.similarOptions)
          : new Map();

      // 6. 增量更新 Astro DataStore
      const existingKeys = new Set(store.keys());
      const remoteIds = new Set<string>();

      for (const post of parsedPosts) {
        const id = post.slug;
        remoteIds.add(id);

        const digest = generateDigest(post.hash);

        // 增量检查：未变更文章跳过重复数据转换
        const existing = store.get(id);
        if (existing && existing.digest === digest) {
          continue;
        }

        const similarPosts = similarityMap.get(post.slug) ?? [];

        const enrichedData = {
          ...post.frontmatter,
          title: post.title,
          slug: post.slug,
          draft: post.draft,
          categories: post.categories,
          ai: {
            ...post.ai,
            similarPosts,
          },
          similarPosts,
        };

        const parsedData = await parseData({
          id,
          data: enrichedData,
        });

        store.set({
          id,
          data: parsedData,
          body: post.content,
          digest,
        });
      }

      // 7. 清理已在 D1 中被删除的文章
      for (const existingId of existingKeys) {
        if (!remoteIds.has(existingId)) {
          store.delete(existingId);
          logger.info(`[hyacine-loader] 清理已下架文章: ${existingId}`);
        }
      }

      logger.info(`[hyacine-loader] 同步完成: 写入/更新 ${remoteIds.size} 篇, 保留增量缓存.`);
    },
  };
}
