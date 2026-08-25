import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { scanPosts } from "./posts";
import type { ProjectConfig } from "../config/project";
import type { AssetIndexEntry } from "@hyacine/contract";

export function scanAssets(projectRoot: string, config: ProjectConfig): AssetIndexEntry[] {
  const assetsDir = join(projectRoot, config.assetsDir);
  if (!existsSync(assetsDir)) return [];
  const files = collectFilesRecursive(assetsDir);
  const entries: AssetIndexEntry[] = [];
  for (const file of files) {
    const rel = relative(projectRoot, file).replace(/\\/g, "/");
    const stat = statSync(file);
    const ext = extname(file).toLowerCase().replace(".", "");
    const assetType = classifyAsset(ext);
    entries.push({
      path: rel,
      isRemote: false,
      assetType,
      fileType: ext || "unknown",
      checksum: null,
      r2Key: null,
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  }
  return entries;
}

function collectFilesRecursive(dir: string): string[] {
  const result: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...collectFilesRecursive(full));
    else if (entry.isFile()) result.push(full);
  }
  return result;
}

function classifyAsset(ext: string): AssetIndexEntry["assetType"] {
  const imageExts = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif", "svg"]);
  const fontExts = new Set(["ttf", "otf", "woff", "woff2"]);
  const videoExts = new Set(["mp4", "webm", "mov"]);
  const audioExts = new Set(["mp3", "wav", "ogg", "flac"]);
  if (imageExts.has(ext)) return "image";
  if (fontExts.has(ext)) return "font";
  if (videoExts.has(ext)) return "video";
  if (audioExts.has(ext)) return "audio";
  return "other";
}

export function buildSyncPayload(
  projectRoot: string,
  config: ProjectConfig,
  lastPaths: string[] | null,
) {
  const posts = scanPosts(projectRoot, config);
  const assets = scanAssets(projectRoot, config);
  const currentPaths = posts.map((p) => p.path);
  // 携带正文：API 落 posts.content，解锁服务端自动 AI / Primary 远程编辑（P0）
  const postsWithContent = posts.map((p) => {
    // path 已为 repo 相对（如 src/posts/hello.md）
    const full = join(projectRoot, p.path);
    let content: string | undefined;
    try {
      content = readFileSync(full, "utf8");
    } catch {
      content = undefined;
    }
    return { ...p, content };
  });
  let deletedPaths: string[] = [];
  if (lastPaths !== null) {
    const currentSet = new Set(currentPaths);
    deletedPaths = lastPaths.filter((p) => !currentSet.has(p));
  }
  return { posts: postsWithContent, assets, deletedPaths };
}

export function chunkText(text: string, maxChars = 800): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length === 0) continue;
    if (current.length + trimmed.length + 2 <= maxChars) {
      current = current.length === 0 ? trimmed : `${current}\n\n${trimmed}`;
    } else {
      if (current.length > 0) {
        chunks.push(current);
        current = "";
      }
      if (trimmed.length > maxChars) {
        // Split long paragraph by sentences, then by hard slices if needed
        const sentences = trimmed.split(/(?<=[.!?。！？])\s+/);
        let buf = "";
        for (const s of sentences) {
          // Hard-slice sentences that still exceed maxChars
          const parts =
            s.length > maxChars ? (s.match(new RegExp(`.{1,${maxChars}}`, "g")) ?? [s]) : [s];
          for (const part of parts) {
            if (buf.length + part.length + 1 <= maxChars) {
              buf = buf.length === 0 ? part : `${buf} ${part}`;
            } else {
              if (buf.length > 0) chunks.push(buf);
              buf = part;
            }
          }
        }
        if (buf.length > 0) chunks.push(buf);
      } else {
        current = trimmed;
      }
    }
    if (chunks.length >= 256) break;
  }
  if (current.length > 0) chunks.push(current);
  if (chunks.length === 0 && text.trim().length > 0) {
    chunks.push(text.trim().slice(0, maxChars));
  }
  return chunks.slice(0, 256);
}
