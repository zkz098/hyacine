import matter from "gray-matter";

export interface ParsedFile {
  data: Record<string, unknown>;
  content: string;
  matter: string;
}

export function parseFrontmatter(raw: string): ParsedFile {
  const parsed = matter(raw);
  return {
    data: parsed.data as Record<string, unknown>,
    content: parsed.content,
    matter: parsed.matter,
  };
}

export function stringifyFrontmatter(data: Record<string, unknown>, content: string): string {
  return matter.stringify(content, data);
}

/** Materialize summary fields into frontmatter, preserving other fields */
export function materializeSummary(
  raw: string,
  summary: string,
  model: string,
  sourceHash: string,
  updatedAt: string,
): string {
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  data.summary = summary;
  data.summaryModel = model;
  data.summarySourceHash = sourceHash;
  data.summaryUpdatedAt = updatedAt;
  // Remove error field if present
  delete data.summaryError;
  let result = matter.stringify(parsed.content, data);
  // Ensure trailing newline
  if (!result.endsWith("\n")) result += "\n";
  return result;
}

export function hasUpToDateSummary(raw: string, currentHash: string): boolean {
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  return data.summary !== undefined && data.summarySourceHash === currentHash;
}
