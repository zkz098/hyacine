import matter from "gray-matter";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";

export interface ParsedFile {
  data: Record<string, unknown>;
  content: string;
  matter: string;
}

const yamlEngine = {
  parse: (input: string): object => {
    const result = yamlParse(input, { schema: "core" });
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
  delete data.summaryError;
  let result = matter.stringify(parsed.content, data, engineOptions);
  if (!result.endsWith("\n")) result += "\n";
  return result;
}

export function hasUpToDateSummary(raw: string, currentHash: string): boolean {
  const parsed = matter(raw, engineOptions);
  const data = parsed.data as Record<string, unknown>;
  return data.summary !== undefined && data.summarySourceHash === currentHash;
}
