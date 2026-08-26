import { z } from "zod";
/**
 * 集合提取产物契约（hyacine.collections.json）：由 `hyc collections` 从博客
 * `src/content.config.ts` 运行时提取生成（降级可读 `.astro/collections/*.schema.json`），
 * 供三端共享：
 * - CLI/桌面：多集合登记（name→dir）、frontmatter 结构校验
 * - 管理台 Editor：schema 驱动的表单渲染（字段类型/enum/secret/image 提示）
 * - API：集合级过滤与 autogen 开关（后续）
 *
 * 注意：schema 是 zod 输入形状的 JSON Schema（draft 2020-12，与 Astro 的
 * `.astro/collections/*.schema.json` 同机制），transform/preprocess/refine 语义不保留。
 */
/** 字段 UI 类型（表单渲染器用） */
export declare const CollectionFieldKindSchema: z.ZodEnum<{
    boolean: "boolean";
    date: "date";
    enum: "enum";
    number: "number";
    "number[]": "number[]";
    object: "object";
    string: "string";
    "string[]": "string[]";
    unknown: "unknown";
}>;
export type CollectionFieldKind = z.infer<typeof CollectionFieldKindSchema>;
export declare const CollectionFieldUiSchema: z.ZodObject<{
    key: z.ZodString;
    kind: z.ZodEnum<{
        boolean: "boolean";
        date: "date";
        enum: "enum";
        number: "number";
        "number[]": "number[]";
        object: "object";
        string: "string";
        "string[]": "string[]";
        unknown: "unknown";
    }>;
    required: z.ZodBoolean;
    hasDefault: z.ZodBoolean;
    secret: z.ZodOptional<z.ZodBoolean>;
    image: z.ZodOptional<z.ZodBoolean>;
    values: z.ZodOptional<z.ZodArray<z.ZodString>>;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CollectionFieldUi = z.infer<typeof CollectionFieldUiSchema>;
export declare const CollectionContentKindSchema: z.ZodEnum<{
    content: "content";
    data: "data";
    unknown: "unknown";
}>;
export type CollectionContentKind = z.infer<typeof CollectionContentKindSchema>;
export declare const CollectionSchema: z.ZodObject<{
    name: z.ZodString;
    dir: z.ZodString;
    pattern: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    extensions: z.ZodDefault<z.ZodArray<z.ZodString>>;
    contentKind: z.ZodEnum<{
        content: "content";
        data: "data";
        unknown: "unknown";
    }>;
    schema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    ui: z.ZodObject<{
        fields: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            kind: z.ZodEnum<{
                boolean: "boolean";
                date: "date";
                enum: "enum";
                number: "number";
                "number[]": "number[]";
                object: "object";
                string: "string";
                "string[]": "string[]";
                unknown: "unknown";
            }>;
            required: z.ZodBoolean;
            hasDefault: z.ZodBoolean;
            secret: z.ZodOptional<z.ZodBoolean>;
            image: z.ZodOptional<z.ZodBoolean>;
            values: z.ZodOptional<z.ZodArray<z.ZodString>>;
            description: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type Collection = z.infer<typeof CollectionSchema>;
export declare const CollectionsFileSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    generatedAt: z.ZodString;
    source: z.ZodEnum<{
        "astro-sync-fallback": "astro-sync-fallback";
        "content.config.ts": "content.config.ts";
    }>;
    collections: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        dir: z.ZodString;
        pattern: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        extensions: z.ZodDefault<z.ZodArray<z.ZodString>>;
        contentKind: z.ZodEnum<{
            content: "content";
            data: "data";
            unknown: "unknown";
        }>;
        schema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        ui: z.ZodObject<{
            fields: z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                kind: z.ZodEnum<{
                    boolean: "boolean";
                    date: "date";
                    enum: "enum";
                    number: "number";
                    "number[]": "number[]";
                    object: "object";
                    string: "string";
                    "string[]": "string[]";
                    unknown: "unknown";
                }>;
                required: z.ZodBoolean;
                hasDefault: z.ZodBoolean;
                secret: z.ZodOptional<z.ZodBoolean>;
                image: z.ZodOptional<z.ZodBoolean>;
                values: z.ZodOptional<z.ZodArray<z.ZodString>>;
                description: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>;
    }, z.core.$strip>>;
    warnings: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type CollectionsFile = z.infer<typeof CollectionsFileSchema>;
/** 严格解析 hyacine.collections.json；不合法返回 null（调用方降级处理） */
export declare function parseCollectionsFile(parsed: unknown): CollectionsFile | null;
