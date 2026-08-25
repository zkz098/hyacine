import type { CollectionFieldUi } from "@hyacine/contract";

/**
 * 基于集合 ui 字段描述的轻量 frontmatter 校验（脱离 ajv，覆盖常见语义）：
 * required / enum / date / boolean / string[]。返回字段级错误消息（空=通过）。
 *
 * 只校验「声明的字段」；frontmatter 允许扩展键（passthrough 语义）不拦。
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim().length === 0) ||
    (Array.isArray(value) && value.length === 0)
  );
}

function parseableDate(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (DATE_RE.test(value)) return true;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

function coerceBoolOk(value: unknown): boolean {
  return (
    typeof value === "boolean" ||
    (typeof value === "string" && (value === "true" || value === "false"))
  );
}

/** 校验 frontmatter 数据；返回错误消息列表 */
export function validateFrontmatter(
  fields: readonly CollectionFieldUi[],
  data: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  for (const field of fields) {
    const value = data[field.key];

    if (field.required && isEmpty(value)) {
      errors.push(`缺少必填字段 ${field.key}`);
      continue;
    }
    if (isEmpty(value)) continue;

    switch (field.kind) {
      case "enum": {
        if (field.values !== undefined && !field.values.includes(String(value))) {
          errors.push(`${field.key} 须为：${field.values.join(" / ")}`);
        }
        break;
      }
      case "date": {
        if (!parseableDate(value)) {
          errors.push(`${field.key} 日期格式无效（建议 ${DATE_RE.source.replace("\\d", "YYYY")}）`);
        }
        break;
      }
      case "boolean": {
        if (!coerceBoolOk(value)) {
          errors.push(`${field.key} 须为布尔值`);
        }
        break;
      }
      case "string[]":
      case "number[]": {
        if (!Array.isArray(value)) {
          errors.push(`${field.key} 须为数组`);
        }
        break;
      }
      default:
        break;
    }
  }
  return errors;
}

/** 把 ui 字段表单值（字符串形态）转换为写回 frontmatter 的 typed 值；空串→undefined */
export function coerceFieldValue(field: CollectionFieldUi, raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  switch (field.kind) {
    case "boolean":
      return trimmed === "true";
    case "string[]":
      return trimmed
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    case "number":
      return Number(trimmed);
    default:
      return trimmed;
  }
}
