import en from "./langs/en.json" with { type: "json" };
import zhCn from "./langs/zh-cn.json" with { type: "json" };

type Dictionary = Record<string, string>;

const dictionaries: Record<string, Dictionary> = {
  en: en as Dictionary,
  "zh-cn": zhCn as Dictionary,
  "zh-CN": zhCn as Dictionary,
};

function resolveLocale(): string {
  const env = process.env.HYACINE_LANG ?? process.env.LANG ?? "";
  const lower = env.toLowerCase();
  if (lower.startsWith("zh")) return "zh-cn";
  return "en";
}

export function getLocale(): string {
  return resolveLocale();
}

export function t(key: string, params?: Record<string, string>): string {
  const locale = resolveLocale();
  const dict = dictionaries[locale] ?? dictionaries.en;
  const template = dict?.[key] ?? dictionaries.en?.[key] ?? key;
  if (params === undefined) return template;
  let result = template;
  for (const [k, v] of Object.entries(params)) {
    result = result.replaceAll(`{${k}}`, v);
  }
  return result;
}
