import { z } from "zod";
/**
 * 插件渲染能力分级：
 * - runtime-only: 仅客户端运行时初始化（无 SSR 依赖）
 * - custom-element: 基于 Web Components 的通用注入
 * - ssr: 服务端/构建时静态渲染（支持 Astro 水合指令）
 */
export declare const RenderCapabilitySchema: z.ZodEnum<{
    "custom-element": "custom-element";
    "runtime-only": "runtime-only";
    ssr: "ssr";
}>;
export type RenderCapability = z.infer<typeof RenderCapabilitySchema>;
/** 插件支持的平台 */
export declare const PluginPlatformTypeSchema: z.ZodEnum<{
    astro: "astro";
    universal: "universal";
}>;
export type PluginPlatformType = z.infer<typeof PluginPlatformTypeSchema>;
/** AST 注入方位策略 */
export declare const InjectPositionSchema: z.ZodEnum<{
    after: "after";
    append: "append";
    before: "before";
    prepend: "prepend";
}>;
export type InjectPosition = z.infer<typeof InjectPositionSchema>;
/** Astro 客户端水合指令 */
export declare const HydrationInstructionSchema: z.ZodEnum<{
    idle: "idle";
    load: "load";
    media: "media";
    visible: "visible";
}>;
export type HydrationInstruction = z.infer<typeof HydrationInstructionSchema>;
/** 注入点高级配置 */
export declare const InjectPointDetailSchema: z.ZodObject<{
    selector: z.ZodString;
    position: z.ZodDefault<z.ZodEnum<{
        after: "after";
        append: "append";
        before: "before";
        prepend: "prepend";
    }>>;
    order: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export type InjectPointDetail = z.infer<typeof InjectPointDetailSchema>;
/** 注入点值：支持简写字符串（如 ".footer-status"）或高级对象配置 */
export declare const InjectPointValueSchema: z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
    selector: z.ZodString;
    position: z.ZodDefault<z.ZodEnum<{
        after: "after";
        append: "append";
        before: "before";
        prepend: "prepend";
    }>>;
    order: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>]>;
export type InjectPointValue = z.infer<typeof InjectPointValueSchema>;
/** 注入点映射表 */
export declare const InjectPointsConfigSchema: z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
    selector: z.ZodString;
    position: z.ZodDefault<z.ZodEnum<{
        after: "after";
        append: "append";
        before: "before";
        prepend: "prepend";
    }>>;
    order: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>]>>;
export type InjectPointsConfig = z.infer<typeof InjectPointsConfigSchema>;
/** 标准插槽预设名称 */
export declare const StandardSlotNameSchema: z.ZodEnum<{
    comment: "comment";
    footer: "footer";
    "footer-status": "footer-status";
    head: "head";
    layout: "layout";
    "post-footer": "post-footer";
    "post-header": "post-header";
    "post-meta": "post-meta";
    sidebar: "sidebar";
    toolbar: "toolbar";
    widgets: "widgets";
}>;
export type StandardSlotName = z.infer<typeof StandardSlotNameSchema>;
/** 基础注入入口 */
export declare const BaseInjectEntrySchema: z.ZodObject<{
    name: z.ZodString;
    path: z.ZodString;
    injectPoint: z.ZodOptional<z.ZodString>;
    order: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/** Runtime-only 插件入口 */
export declare const RuntimeOnlyEntrySchema: z.ZodObject<{
    name: z.ZodString;
    path: z.ZodString;
    injectPoint: z.ZodOptional<z.ZodString>;
    order: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"runtime-only">;
    options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type RuntimeOnlyEntry = z.infer<typeof RuntimeOnlyEntrySchema>;
/** Custom Element 插件入口 */
export declare const CustomElementEntrySchema: z.ZodObject<{
    name: z.ZodString;
    path: z.ZodString;
    order: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"custom-element">;
    injectPoint: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export type CustomElementEntry = z.infer<typeof CustomElementEntrySchema>;
/** SSR 插件入口 */
export declare const SSREntrySchema: z.ZodObject<{
    name: z.ZodString;
    path: z.ZodString;
    injectPoint: z.ZodOptional<z.ZodString>;
    order: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"ssr">;
    platform: z.ZodOptional<z.ZodEnum<{
        astro: "astro";
        universal: "universal";
    }>>;
    requiresArticle: z.ZodOptional<z.ZodBoolean>;
    clientHydrationInstruction: z.ZodOptional<z.ZodEnum<{
        idle: "idle";
        load: "load";
        media: "media";
        visible: "visible";
    }>>;
    props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type SSREntry = z.infer<typeof SSREntrySchema>;
export declare const InjectEntrySchema: z.ZodUnion<readonly [z.ZodObject<{
    name: z.ZodString;
    path: z.ZodString;
    injectPoint: z.ZodOptional<z.ZodString>;
    order: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"runtime-only">;
    options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>, z.ZodObject<{
    name: z.ZodString;
    path: z.ZodString;
    order: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"custom-element">;
    injectPoint: z.ZodDefault<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    name: z.ZodString;
    path: z.ZodString;
    injectPoint: z.ZodOptional<z.ZodString>;
    order: z.ZodOptional<z.ZodNumber>;
    type: z.ZodLiteral<"ssr">;
    platform: z.ZodOptional<z.ZodEnum<{
        astro: "astro";
        universal: "universal";
    }>>;
    requiresArticle: z.ZodOptional<z.ZodBoolean>;
    clientHydrationInstruction: z.ZodOptional<z.ZodEnum<{
        idle: "idle";
        load: "load";
        media: "media";
        visible: "visible";
    }>>;
    props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>]>;
export type InjectEntry = z.infer<typeof InjectEntrySchema>;
/** 插件 Manifest */
export declare const PluginManifestSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
    minRenderCapability: z.ZodEnum<{
        "custom-element": "custom-element";
        "runtime-only": "runtime-only";
        ssr: "ssr";
    }>;
    supportedPlatforms: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        astro: "astro";
        universal: "universal";
    }>>>;
    compatibleAPIPattern: z.ZodOptional<z.ZodString>;
    entry: z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
        name: z.ZodString;
        path: z.ZodString;
        injectPoint: z.ZodOptional<z.ZodString>;
        order: z.ZodOptional<z.ZodNumber>;
        type: z.ZodLiteral<"runtime-only">;
        options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>, z.ZodObject<{
        name: z.ZodString;
        path: z.ZodString;
        order: z.ZodOptional<z.ZodNumber>;
        type: z.ZodLiteral<"custom-element">;
        injectPoint: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        name: z.ZodString;
        path: z.ZodString;
        injectPoint: z.ZodOptional<z.ZodString>;
        order: z.ZodOptional<z.ZodNumber>;
        type: z.ZodLiteral<"ssr">;
        platform: z.ZodOptional<z.ZodEnum<{
            astro: "astro";
            universal: "universal";
        }>>;
        requiresArticle: z.ZodOptional<z.ZodBoolean>;
        clientHydrationInstruction: z.ZodOptional<z.ZodEnum<{
            idle: "idle";
            load: "load";
            media: "media";
            visible: "visible";
        }>>;
        props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>]>>;
}, z.core.$strip>;
export type PluginManifest = z.infer<typeof PluginManifestSchema>;
/** 插件系统主配置 */
export declare const HyacinePluginSystemConfigSchema: z.ZodObject<{
    injectPoints: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodObject<{
        selector: z.ZodString;
        position: z.ZodDefault<z.ZodEnum<{
            after: "after";
            append: "append";
            before: "before";
            prepend: "prepend";
        }>>;
        order: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>]>>>;
    postCollection: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    plugins: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        version: z.ZodString;
        minRenderCapability: z.ZodEnum<{
            "custom-element": "custom-element";
            "runtime-only": "runtime-only";
            ssr: "ssr";
        }>;
        supportedPlatforms: z.ZodOptional<z.ZodArray<z.ZodEnum<{
            astro: "astro";
            universal: "universal";
        }>>>;
        compatibleAPIPattern: z.ZodOptional<z.ZodString>;
        entry: z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
            name: z.ZodString;
            path: z.ZodString;
            injectPoint: z.ZodOptional<z.ZodString>;
            order: z.ZodOptional<z.ZodNumber>;
            type: z.ZodLiteral<"runtime-only">;
            options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>, z.ZodObject<{
            name: z.ZodString;
            path: z.ZodString;
            order: z.ZodOptional<z.ZodNumber>;
            type: z.ZodLiteral<"custom-element">;
            injectPoint: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            name: z.ZodString;
            path: z.ZodString;
            injectPoint: z.ZodOptional<z.ZodString>;
            order: z.ZodOptional<z.ZodNumber>;
            type: z.ZodLiteral<"ssr">;
            platform: z.ZodOptional<z.ZodEnum<{
                astro: "astro";
                universal: "universal";
            }>>;
            requiresArticle: z.ZodOptional<z.ZodBoolean>;
            clientHydrationInstruction: z.ZodOptional<z.ZodEnum<{
                idle: "idle";
                load: "load";
                media: "media";
                visible: "visible";
            }>>;
            props: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strip>]>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type HyacinePluginSystemConfig = z.infer<typeof HyacinePluginSystemConfigSchema>;
export type HyacinePluginConfigInput = z.input<typeof HyacinePluginSystemConfigSchema>;
/** 传递给 SSR 插件的文章上下文 (强类型) */
export declare const HyacineArticleContextSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    data: z.ZodOptional<z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        slug: z.ZodOptional<z.ZodString>;
        categories: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        tags: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodString>]>>;
        draft: z.ZodOptional<z.ZodBoolean>;
        date: z.ZodOptional<z.ZodString>;
        updated: z.ZodOptional<z.ZodString>;
        summary: z.ZodOptional<z.ZodString>;
        summaryModel: z.ZodOptional<z.ZodString>;
        summarySourceHash: z.ZodOptional<z.ZodString>;
        summaryUpdatedAt: z.ZodOptional<z.ZodString>;
        summaryError: z.ZodOptional<z.ZodString>;
    }, z.core.$loose>>;
    body: z.ZodOptional<z.ZodString>;
    collection: z.ZodOptional<z.ZodString>;
}, z.core.$loose>;
export type HyacineArticleContext = z.infer<typeof HyacineArticleContextSchema>;
