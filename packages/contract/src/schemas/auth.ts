import { z } from "zod";
import { IsoDateSchema, ScopeSchema, type Scope } from "./common";

export const SetupStatusSchema = z.object({
  needsSetup: z.boolean(),
});

export type SetupStatus = z.infer<typeof SetupStatusSchema>;

/** setup code（worker secret SETUP_CODE）交换长期 token */
export const SetupRequestSchema = z.object({
  code: z.string().min(8).max(256),
  label: z.string().min(1).max(64).optional(),
});

export type SetupRequest = z.infer<typeof SetupRequestSchema>;

export const SetupResponseSchema = z.object({
  token: z.string().min(16),
  tokenId: z.string().min(8),
  label: z.string(),
  scopes: z.array(ScopeSchema),
  expiresAt: IsoDateSchema.nullable(),
});

export type SetupResponse = z.infer<typeof SetupResponseSchema>;

/** 管理员创建子 token（Desktop/CLI 分离） */
export const TokenCreateRequestSchema = z.object({
  label: z.string().min(1).max(64),
  scopes: z.array(ScopeSchema).min(1),
  expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
});

export type TokenCreateRequest = z.infer<typeof TokenCreateRequestSchema>;

export const TokenCreateResponseSchema = z.object({
  token: z.string().min(16),
  tokenId: z.string().min(8),
  label: z.string(),
  scopes: z.array(ScopeSchema),
  expiresAt: IsoDateSchema.nullable(),
});

export type TokenCreateResponse = z.infer<typeof TokenCreateResponseSchema>;

export const TokenInfoSchema = z.object({
  id: z.string().min(8),
  label: z.string(),
  scopes: z.array(ScopeSchema),
  expiresAt: IsoDateSchema.nullable(),
  lastUsedAt: IsoDateSchema.nullable(),
  createdAt: IsoDateSchema,
  revoked: z.boolean(),
});

export type TokenInfo = z.infer<typeof TokenInfoSchema>;

export const TokenListResponseSchema = z.object({
  tokens: z.array(TokenInfoSchema),
});

export type TokenListResponse = z.infer<typeof TokenListResponseSchema>;

export const TokenRevokeResponseSchema = z.object({
  id: z.string(),
  revoked: z.boolean(),
});

export type TokenRevokeResponse = z.infer<typeof TokenRevokeResponseSchema>;

/** 健康检查：CLI 本地/远程判断用；primary.available = GitHub 桥配置齐（Primary 模式可用） */
export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  version: z.string(),
  needsSetup: z.boolean(),
  ai: z.object({
    summary: z.boolean(),
    embed: z.boolean(),
  }),
  primary: z.object({
    available: z.boolean(),
    repo: z.string().nullable(),
  }),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export type { Scope };
