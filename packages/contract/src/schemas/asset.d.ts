import { z } from "zod";
export type AssetType = "image" | "font" | "video" | "audio" | "other";
export declare const AssetTypeSchema: z.ZodEnum<{
    audio: "audio";
    font: "font";
    image: "image";
    other: "other";
    video: "video";
}>;
/** 资产索引条目（is_remote=false 的本地资产只登记清单，不存字节） */
export declare const AssetIndexEntrySchema: z.ZodObject<{
    path: z.ZodString;
    isRemote: z.ZodBoolean;
    assetType: z.ZodEnum<{
        audio: "audio";
        font: "font";
        image: "image";
        other: "other";
        video: "video";
    }>;
    fileType: z.ZodString;
    checksum: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    r2Key: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    size: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type AssetIndexEntry = z.infer<typeof AssetIndexEntrySchema>;
/** R2 presign 请求：CLI/管理台上传图片直传 R2，不经 Worker 字节 */
export declare const PresignRequestSchema: z.ZodObject<{
    key: z.ZodString;
    contentType: z.ZodString;
    size: z.ZodNumber;
}, z.core.$strip>;
export type PresignRequest = z.infer<typeof PresignRequestSchema>;
export declare const PresignResponseSchema: z.ZodObject<{
    key: z.ZodString;
    url: z.ZodString;
    method: z.ZodLiteral<"PUT">;
    headers: z.ZodRecord<z.ZodString, z.ZodString>;
    expiresAt: z.ZodString;
}, z.core.$strip>;
export type PresignResponse = z.infer<typeof PresignResponseSchema>;
/** 上传完成后登记为远程资产 */
export declare const RegisterAssetRequestSchema: z.ZodObject<{
    path: z.ZodString;
    assetType: z.ZodEnum<{
        audio: "audio";
        font: "font";
        image: "image";
        other: "other";
        video: "video";
    }>;
    fileType: z.ZodString;
    r2Key: z.ZodString;
    checksum: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    size: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, z.core.$strip>;
export type RegisterAssetRequest = z.infer<typeof RegisterAssetRequestSchema>;
export declare const RegisterAssetResponseSchema: z.ZodObject<{
    path: z.ZodString;
    registered: z.ZodBoolean;
}, z.core.$strip>;
export type RegisterAssetResponse = z.infer<typeof RegisterAssetResponseSchema>;
export declare const AssetsListResponseSchema: z.ZodObject<{
    assets: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        isRemote: z.ZodBoolean;
        assetType: z.ZodEnum<{
            audio: "audio";
            font: "font";
            image: "image";
            other: "other";
            video: "video";
        }>;
        fileType: z.ZodString;
        checksum: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        r2Key: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        size: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AssetsListResponse = z.infer<typeof AssetsListResponseSchema>;
