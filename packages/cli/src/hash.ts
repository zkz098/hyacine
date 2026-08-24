import { createHash } from "node:crypto";

/** Content hash: sha256 hex truncated to 16 chars (contract requires 8-128 hex) */
export function contentHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex").slice(0, 16);
}

export function fileHash(content: string): string {
  return contentHash(content);
}
