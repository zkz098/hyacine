/** Slug: lowercase, alphanumeric + hyphen, no leading/trailing hyphen */
export function slugify(input: string): string {
  const trimmed = input.trim().toLowerCase();
  // Replace whitespace and underscores with hyphen, keep alphanumeric and hyphen
  const hyphenated = trimmed
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (hyphenated.length === 0) {
    return "untitled";
  }
  return hyphenated;
}
