import { z } from "zod";

/**
 * hyacine 配置 schema（三端共享）：
 * - CloudConfig：服务级动态配置（AI/嵌入/R2），env 为默认值、D1 app_config 覆盖，
 *   管理台可读写，改动即时生效免 redeploy。
 * - ProjectConfig：博客项目布局配置（hyacine.yml），CLI 与桌面端共用解析。
 */

// ---- CloudConfig（服务级动态配置） ---------------------------------------

/** 敏感值约定：GET 只回显 { set: boolean }，不回明文；PUT 传空串=清除、缺省=不变 */
export const SecretInfoSchema = z.object({
  set: z.boolean(),
});

export const AiSummaryConfigSchema = z.object({
  endpoint: z.string().min(1).max(1024).optional(),
  key: z.string().min(1).max(4096).optional(),
  model: z.string().min(1).max(128).optional(),
});
export const R2ConfigSchema = z.object({
  endpoint: z.string().min(1).max(1024).optional(),
  accessKeyId: z.string().min(1).max(128).optional(),
  secretAccessKey: z.string().min(1).max(512).optional(),
  bucket: z.string().min(1).max(128).optional(),
});

/** 摘要提供方：byok=OpenAI 兼容端点（现状）；workers-ai=Workers AI（model 填 @cf/... 模型 id） */
export const AiSummaryProviderSchema = z.enum(["byok", "workers-ai"]);

export type AiSummaryProvider = z.infer<typeof AiSummaryProviderSchema>;

/** 云端配置的「内部形状」：env 默认 + D1 覆盖后的有效值；空串=未配置 */
export const CloudConfigSchema = z.object({
  aiSummary: z.object({
    endpoint: z.string(),
    key: z.string(),
    model: z.string(),
    provider: AiSummaryProviderSchema.default("byok"),
    /** 新/变更文章上行后是否自动生成摘要 */
    autogen: z.boolean().default(false),
  }),
  embedModel: z.string(),
  /** 新/变更文章上行后是否自动生成嵌入 */
  embedAutogen: z.boolean().default(false),
  /** Primary 模式：GitHub 仓库（PAT 仅写 repository_dispatch） */
  github: z.object({
    repoOwner: z.string(),
    repoName: z.string(),
    token: z.string(),
  }),
  r2: z.object({
    endpoint: z.string(),
    accessKeyId: z.string(),
    secretAccessKey: z.string(),
    bucket: z.string(),
  }),
});

export type CloudConfig = z.infer<typeof CloudConfigSchema>;

/** GET /api/admin/config 响应：有效值 + 敏感项 set 标志（不回明文） */
export const EffectiveConfigSchema = z.object({
  aiSummary: z.object({
    endpoint: z.string(),
    key: SecretInfoSchema,
    model: z.string(),
    provider: AiSummaryProviderSchema,
    autogen: z.boolean(),
  }),
  embedModel: z.string(),
  embedAutogen: z.boolean(),
  github: z.object({
    repoOwner: z.string(),
    repoName: z.string(),
    token: SecretInfoSchema,
  }),
  r2: z.object({
    endpoint: z.string(),
    accessKeyId: z.string(),
    secretAccessKey: SecretInfoSchema,
    bucket: z.string(),
  }),
});

export type EffectiveConfig = z.infer<typeof EffectiveConfigSchema>;

/** PUT /api/admin/config 请求：部分更新；undefined=不变、""=清除、非空=设置 */
export const ConfigUpdateRequestSchema = z
  .object({
    aiSummary: z
      .object({
        endpoint: z.string().max(1024).optional(),
        key: z.string().max(4096).optional(),
        model: z.string().max(128).optional(),
        provider: AiSummaryProviderSchema.optional(),
        autogen: z.boolean().optional(),
      })
      .strict()
      .optional(),
    embedModel: z.string().max(128).optional(),
    embedAutogen: z.boolean().optional(),
    github: z
      .object({
        repoOwner: z.string().max(128).optional(),
        repoName: z.string().max(128).optional(),
        token: z.string().max(512).optional(),
      })
      .strict()
      .optional(),
    r2: z
      .object({
        endpoint: z.string().max(1024).optional(),
        accessKeyId: z.string().max(128).optional(),
        secretAccessKey: z.string().max(512).optional(),
        bucket: z.string().max(128).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type ConfigUpdateRequest = z.infer<typeof ConfigUpdateRequestSchema>;

/** app_config 表的扁平 key（D1 行） */
export const APP_CONFIG_KEYS = [
  "aiSummary.endpoint",
  "aiSummary.key",
  "aiSummary.model",
  "aiSummary.provider",
  "aiSummary.autogen",
  "embedAutogen",
  "embedModel",
  "github.repoOwner",
  "github.repoName",
  "github.token",
  "r2.endpoint",
  "r2.accessKeyId",
  "r2.secretAccessKey",
  "r2.bucket",
] as const;

// ---- ProjectConfig（博客项目布局，hyacine.yml） --------------------------

/** 集合目录声明：name → repo 相对目录（如 posts: src/posts, moments: src/moments） */
export const ProjectCollectionsSchema = z.record(z.string().min(1).max(64), z.string().min(1));

export const ProjectConfigSchema = z.object({
  contentDir: z.string().min(1).default("src/posts"),
  assetsDir: z.string().min(1).default("src/assets"),
  postExtension: z.array(z.string().min(1)).default([".md", ".mdx"]),
  /** 多集合注册表（缺省回退单集合 posts → contentDir） */
  collections: ProjectCollectionsSchema.optional(),
  /** 博客主题的配置路径（astro-blog 侧用，桌面端可忽略） */
  themeConfigPath: z.string().min(1).nullable().default(null),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  contentDir: "src/posts",
  assetsDir: "src/assets",
  postExtension: [".md", ".mdx"],
  themeConfigPath: null,
};

export function parseProjectConfig(parsed: unknown): ProjectConfig {
  const result = ProjectConfigSchema.safeParse(parsed ?? {});
  if (!result.success) return { ...DEFAULT_PROJECT_CONFIG };
  return { ...DEFAULT_PROJECT_CONFIG, ...result.data };
}

/** 集合描述（getCollections 产出） */
export interface CollectionSpec {
  name: string;
  /** repo 相对目录（不含尾部斜杠），如 src/posts */
  dir: string;
}

/**
 * 有效集合列表：注册表优先；缺省回退单集合 posts→contentDir。
 * 目录统一 posix、去尾部斜杠；名去重（保留首现）。
 */
function normalizeDir(d: string): string {
  return d.replace(/\\/g, "/").replace(/\/$/, "");
}

export function getCollections(config: ProjectConfig): CollectionSpec[] {
  const entries = config.collections ?? {};
  const names = Object.keys(entries);
  if (names.length > 0) {
    const seen = new Set<string>();
    const specs: CollectionSpec[] = [];
    for (const name of names) {
      const raw = entries[name];
      if (typeof raw !== "string") continue;
      const dir = normalizeDir(raw);
      if (dir.length === 0 || seen.has(dir)) continue;
      seen.add(dir);
      specs.push({ name, dir });
    }
    if (specs.length > 0) return specs;
  }
  return [{ name: "posts", dir: normalizeDir(config.contentDir) }];
}
