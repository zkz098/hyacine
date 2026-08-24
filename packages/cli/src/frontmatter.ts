import matter from "gray-matter";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";

export interface ParsedFile {
  data: Record<string, unknown>;
  content: string;
  matter: string;
}

/**
 * 自定义 yaml engine：用 yaml 包的 core schema（不解析时间戳）。
 * 默认 js-yaml 会把 `date: 2026-08-01` 变成 Date 对象、stringify 时重写为
 * `2026-08-01T00:00:00.000Z`——污染 git diff。core schema 下日期保持字符串。
 */
const yamlEngine = {
  parse: (input: string): object => {
    const result = yamlParse(input, { schema: "core" });
    // frontmatter 必须是 mapping；非 mapping 视为空（同时避免裸断言）
    if (result === null || typeof result !== "object" || Array.isArray(result)) {
      return {};
    }
    return result;
  },
  stringify: (data: unknown): string => yamlStringify(data),
};

const engineOptions = { engines: { yaml: yamlEngine } };

export function parseFrontmatter(raw: string): ParsedFile {
  const parsed = matter(raw, engineOptions);
  return {
    data: parsed.data as Record<string, unknown>,
    content: parsed.content,
    matter: parsed.matter,
  };
}

export function stringifyFrontmatter(data: Record<string, unknown>, content: string): string {
  return matter.stringify(content, data, engineOptions);
}

/** Materialize summary fields into frontmatter, preserving other fields */
export function materializeSummary(
  raw: string,
  summary: string,
  model: string,
  sourceHash: string,
  updatedAt: string,
): string {
  const parsed = matter(raw, engineOptions);
  const data = parsed.data as Record<string, unknown>;
  data.summary = summary;
  data.summaryModel = model;
  data.summarySourceHash = sourceHash;
  data.summaryUpdatedAt = updatedAt;
  // Remove error field if present
  delete data.summaryError;
  let result = matter.stringify(parsed.content, data, engineOptions);
  // Ensure trailing newline
  if (!result.endsWith("\n")) result += "\n";
  return result;
}

export function hasUpToDateSummary(raw: string, currentHash: string): boolean {
  const parsed = matter(raw, engineOptions);
  const data = parsed.data as Record<string, unknown>;
  return data.summary !== undefined && data.summarySourceHash === currentHash;
}
