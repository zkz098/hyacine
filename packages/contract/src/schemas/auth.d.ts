import { z } from "zod";
import { type Scope } from "./common";
export declare const SetupStatusSchema: z.ZodObject<{
    needsSetup: z.ZodBoolean;
}, z.core.$strip>;
export type SetupStatus = z.infer<typeof SetupStatusSchema>;
/** setup code（worker secret SETUP_CODE）交换长期 token */
export declare const SetupRequestSchema: z.ZodObject<{
    code: z.ZodString;
    label: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SetupRequest = z.infer<typeof SetupRequestSchema>;
export declare const SetupResponseSchema: z.ZodObject<{
    token: z.ZodString;
    tokenId: z.ZodString;
    label: z.ZodString;
    scopes: z.ZodArray<z.ZodEnum<{
        admin: "admin";
        ai: "ai";
        "posts.r": "posts.r";
        "posts.w": "posts.w";
    }>>;
    expiresAt: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type SetupResponse = z.infer<typeof SetupResponseSchema>;
/** 管理员创建子 token（Desktop/CLI 分离） */
export declare const TokenCreateRequestSchema: z.ZodObject<{
    label: z.ZodString;
    scopes: z.ZodArray<z.ZodEnum<{
        admin: "admin";
        ai: "ai";
        "posts.r": "posts.r";
        "posts.w": "posts.w";
    }>>;
    expiresInDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, z.core.$strip>;
export type TokenCreateRequest = z.infer<typeof TokenCreateRequestSchema>;
export declare const TokenCreateResponseSchema: z.ZodObject<{
    token: z.ZodString;
    tokenId: z.ZodString;
    label: z.ZodString;
    scopes: z.ZodArray<z.ZodEnum<{
        admin: "admin";
        ai: "ai";
        "posts.r": "posts.r";
        "posts.w": "posts.w";
    }>>;
    expiresAt: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type TokenCreateResponse = z.infer<typeof TokenCreateResponseSchema>;
export declare const TokenInfoSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    scopes: z.ZodArray<z.ZodEnum<{
        admin: "admin";
        ai: "ai";
        "posts.r": "posts.r";
        "posts.w": "posts.w";
    }>>;
    expiresAt: z.ZodNullable<z.ZodString>;
    lastUsedAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    revoked: z.ZodBoolean;
}, z.core.$strip>;
export type TokenInfo = z.infer<typeof TokenInfoSchema>;
export declare const TokenListResponseSchema: z.ZodObject<{
    tokens: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        scopes: z.ZodArray<z.ZodEnum<{
            admin: "admin";
            ai: "ai";
            "posts.r": "posts.r";
            "posts.w": "posts.w";
        }>>;
        expiresAt: z.ZodNullable<z.ZodString>;
        lastUsedAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        revoked: z.ZodBoolean;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type TokenListResponse = z.infer<typeof TokenListResponseSchema>;
export declare const TokenRevokeResponseSchema: z.ZodObject<{
    id: z.ZodString;
    revoked: z.ZodBoolean;
}, z.core.$strip>;
export type TokenRevokeResponse = z.infer<typeof TokenRevokeResponseSchema>;
/** 健康检查：CLI 本地/远程判断用；mode: "cloud" | "local" */
export declare const HealthResponseSchema: z.ZodObject<{
    ok: z.ZodLiteral<true>;
    version: z.ZodString;
    needsSetup: z.ZodBoolean;
    mode: z.ZodDefault<z.ZodEnum<{
        cloud: "cloud";
        gateway: "gateway";
        local: "local";
        replica: "replica";
    }>>;
    ai: z.ZodObject<{
        summary: z.ZodBoolean;
        embed: z.ZodBoolean;
    }, z.core.$strip>;
    gateway: z.ZodOptional<z.ZodObject<{
        available: z.ZodBoolean;
    }, z.core.$strip>>;
    primary: z.ZodOptional<z.ZodObject<{
        available: z.ZodBoolean;
        repo: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$loose>>;
}, z.core.$strip>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type { Scope };
