import { z } from "zod";
/**
 * hyacine 配置 schema（三端共享）：
 * - CloudConfig：服务级动态配置（AI/嵌入/R2），env 为默认值、D1 app_config 覆盖，
 *   管理台可读写，改动即时生效免 redeploy。
 * - ProjectConfig：博客项目布局配置（hyacine.yml），CLI 与桌面端共用解析。
 */
/** 敏感值约定：GET 只回显 { set: boolean }，不回明文；PUT 传空串=清除、缺省=不变 */
export declare const SecretInfoSchema: z.ZodObject<{
    set: z.ZodBoolean;
}, z.core.$strip>;
export declare const AiSummaryConfigSchema: z.ZodObject<{
    endpoint: z.ZodOptional<z.ZodString>;
    key: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const R2ConfigSchema: z.ZodObject<{
    endpoint: z.ZodOptional<z.ZodString>;
    accessKeyId: z.ZodOptional<z.ZodString>;
    secretAccessKey: z.ZodOptional<z.ZodString>;
    bucket: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** 摘要提供方：byok=OpenAI 兼容端点（现状）；workers-ai=Workers AI（model 填 @cf/... 模型 id） */
export declare const AiSummaryProviderSchema: z.ZodEnum<{
    byok: "byok";
    "workers-ai": "workers-ai";
}>;
export type AiSummaryProvider = z.infer<typeof AiSummaryProviderSchema>;
/** 云端配置的「内部形状」：env 默认 + D1 覆盖后的有效值；空串=未配置 */
export declare const CloudConfigSchema: z.ZodObject<{
    aiSummary: z.ZodObject<{
        endpoint: z.ZodString;
        key: z.ZodString;
        model: z.ZodString;
        provider: z.ZodDefault<z.ZodEnum<{
            byok: "byok";
            "workers-ai": "workers-ai";
        }>>;
        autogen: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>;
    embedModel: z.ZodString;
    embedAutogen: z.ZodDefault<z.ZodBoolean>;
    github: z.ZodObject<{
        repoOwner: z.ZodString;
        repoName: z.ZodString;
        token: z.ZodString;
    }, z.core.$strip>;
    r2: z.ZodObject<{
        endpoint: z.ZodString;
        accessKeyId: z.ZodString;
        secretAccessKey: z.ZodString;
        bucket: z.ZodString;
    }, z.core.$strip>;
    sync: z.ZodDefault<z.ZodObject<{
        boundProjectId: z.ZodDefault<z.ZodString>;
        maxDeleteRatio: z.ZodDefault<z.ZodNumber>;
        maxDeleteLimit: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type CloudConfig = z.infer<typeof CloudConfigSchema>;
/** GET /api/admin/config 响应：有效值 + 敏感项 set 标志（不回明文） */
export declare const EffectiveConfigSchema: z.ZodObject<{
    aiSummary: z.ZodObject<{
        endpoint: z.ZodString;
        key: z.ZodObject<{
            set: z.ZodBoolean;
        }, z.core.$strip>;
        model: z.ZodString;
        provider: z.ZodEnum<{
            byok: "byok";
            "workers-ai": "workers-ai";
        }>;
        autogen: z.ZodBoolean;
    }, z.core.$strip>;
    embedModel: z.ZodString;
    embedAutogen: z.ZodBoolean;
    github: z.ZodObject<{
        repoOwner: z.ZodString;
        repoName: z.ZodString;
        token: z.ZodObject<{
            set: z.ZodBoolean;
        }, z.core.$strip>;
    }, z.core.$strip>;
    r2: z.ZodObject<{
        endpoint: z.ZodString;
        accessKeyId: z.ZodString;
        secretAccessKey: z.ZodObject<{
            set: z.ZodBoolean;
        }, z.core.$strip>;
        bucket: z.ZodString;
    }, z.core.$strip>;
    sync: z.ZodObject<{
        boundProjectId: z.ZodString;
        maxDeleteRatio: z.ZodNumber;
        maxDeleteLimit: z.ZodNumber;
    }, z.core.$strip>;
}, z.core.$strip>;
export type EffectiveConfig = z.infer<typeof EffectiveConfigSchema>;
/** PUT /api/admin/config 请求：部分更新；undefined=不变、""=清除、非空=设置 */
export declare const ConfigUpdateRequestSchema: z.ZodObject<{
    aiSummary: z.ZodOptional<z.ZodObject<{
        endpoint: z.ZodOptional<z.ZodString>;
        key: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        provider: z.ZodOptional<z.ZodEnum<{
            byok: "byok";
            "workers-ai": "workers-ai";
        }>>;
        autogen: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>>;
    embedModel: z.ZodOptional<z.ZodString>;
    embedAutogen: z.ZodOptional<z.ZodBoolean>;
    github: z.ZodOptional<z.ZodObject<{
        repoOwner: z.ZodOptional<z.ZodString>;
        repoName: z.ZodOptional<z.ZodString>;
        token: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    r2: z.ZodOptional<z.ZodObject<{
        endpoint: z.ZodOptional<z.ZodString>;
        accessKeyId: z.ZodOptional<z.ZodString>;
        secretAccessKey: z.ZodOptional<z.ZodString>;
        bucket: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>>;
    sync: z.ZodOptional<z.ZodObject<{
        boundProjectId: z.ZodOptional<z.ZodString>;
        maxDeleteRatio: z.ZodOptional<z.ZodNumber>;
        maxDeleteLimit: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type ConfigUpdateRequest = z.infer<typeof ConfigUpdateRequestSchema>;
/** app_config 表的扁平 key（D1 行） */
export declare const APP_CONFIG_KEYS: readonly ["aiSummary.endpoint", "aiSummary.key", "aiSummary.model", "aiSummary.provider", "aiSummary.autogen", "embedAutogen", "embedModel", "github.repoOwner", "github.repoName", "github.token", "r2.endpoint", "r2.accessKeyId", "r2.secretAccessKey", "r2.bucket", "sync.boundProjectId", "sync.maxDeleteRatio", "sync.maxDeleteLimit"];
/** 集合目录声明：name → repo 相对目录（如 posts: src/posts, moments: src/moments） */
export declare const ProjectCollectionsSchema: z.ZodRecord<z.ZodString, z.ZodString>;
export declare const ProjectConfigSchema: z.ZodObject<{
    projectId: z.ZodOptional<z.ZodString>;
    contentDir: z.ZodDefault<z.ZodString>;
    assetsDir: z.ZodDefault<z.ZodString>;
    postExtension: z.ZodDefault<z.ZodArray<z.ZodString>>;
    collections: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    themeConfigPath: z.ZodDefault<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export declare const DEFAULT_PROJECT_CONFIG: ProjectConfig;
export declare function parseProjectConfig(parsed: unknown): ProjectConfig;
/** 集合描述（getCollections 产出） */
export interface CollectionSpec {
    name: string;
    /** repo 相对目录（不含尾部斜杠），如 src/posts */
    dir: string;
}
export declare function getCollections(config: ProjectConfig): CollectionSpec[];
