import {
  type HyacinePluginConfigInput,
  type HyacinePluginSystemConfig,
  type InjectPointDetail,
  type InjectPointsConfig,
  type InjectPointValue,
  HyacinePluginSystemConfigSchema,
} from "@hyacine/contract";

/**
 * 将用户配置的注入点（简写字符串或高级对象）归一化为标准的 InjectPointDetail 对象
 */
export function normalizeInjectPoint(value: InjectPointValue): InjectPointDetail {
  if (typeof value === "string") {
    return {
      selector: value.trim(),
      position: "append",
      order: 0,
    };
  }
  return {
    selector: value.selector.trim(),
    position: value.position ?? "append",
    order: value.order ?? 0,
  };
}

/**
 * 归一化所有注入点映射
 */
export function normalizeInjectPoints(
  rawPoints: InjectPointsConfig = {},
): Record<string, InjectPointDetail> {
  const normalized: Record<string, InjectPointDetail> = {};
  for (const [name, value] of Object.entries(rawPoints)) {
    if (value) {
      normalized[name] = normalizeInjectPoint(value);
    }
  }
  return normalized;
}

/**
 * 声明并校验 Hyacine 插件系统配置文件
 */
export function defineConfig(config: HyacinePluginConfigInput): HyacinePluginSystemConfig {
  const result = HyacinePluginSystemConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`[hyacine-plugin] Invalid configuration: ${result.error.message}`);
  }
  return result.data;
}
