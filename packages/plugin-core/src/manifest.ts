import {
  type CustomElementEntry,
  type HyacineArticleContext,
  type HyacinePluginSystemConfig,
  type HydrationInstruction,
  type InjectEntry,
  type InjectPointDetail,
  type InjectPointsConfig,
  type InjectPointValue,
  type InjectPosition,
  type PluginManifest,
  type PluginPlatformType,
  type RenderCapability,
  type RuntimeOnlyEntry,
  type SSREntry,
  type StandardSlotName,
  PluginManifestSchema,
} from "@hyacine/contract";

export type {
  CustomElementEntry,
  HyacineArticleContext,
  HyacinePluginSystemConfig,
  HydrationInstruction,
  InjectEntry,
  InjectPointDetail,
  InjectPointsConfig,
  InjectPointValue,
  InjectPosition,
  PluginManifest,
  PluginPlatformType,
  RenderCapability,
  RuntimeOnlyEntry,
  SSREntry,
  StandardSlotName,
};

export type PluginFunction<TOptions = any> = (options: TOptions) => PluginManifest;

/**
 * 声明并校验一个 Hyacine 插件 Manifest
 */
export function definePlugin(manifest: PluginManifest): PluginManifest {
  const result = PluginManifestSchema.safeParse(manifest);
  if (!result.success) {
    throw new Error(
      `[hyacine-plugin] Invalid plugin manifest for "${manifest?.name}": ${result.error.message}`,
    );
  }
  return result.data;
}
