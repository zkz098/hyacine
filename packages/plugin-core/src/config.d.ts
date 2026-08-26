import { type HyacinePluginConfigInput, type HyacinePluginSystemConfig, type InjectPointDetail, type InjectPointsConfig, type InjectPointValue } from "@hyacine/contract";
/**
 * 将用户配置的注入点（简写字符串或高级对象）归一化为标准的 InjectPointDetail 对象
 */
export declare function normalizeInjectPoint(value: InjectPointValue): InjectPointDetail;
/**
 * 归一化所有注入点映射
 */
export declare function normalizeInjectPoints(rawPoints?: InjectPointsConfig): Record<string, InjectPointDetail>;
/**
 * 声明并校验 Hyacine 插件系统配置文件
 */
export declare function defineConfig(config: HyacinePluginConfigInput): HyacinePluginSystemConfig;
