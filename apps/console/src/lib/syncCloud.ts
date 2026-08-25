/**
 * 桌面端「一键同步到云端」：把本地项目（posts + assets 索引）打包成
 * SyncUploadRequest 上行到 API（与 CLI `hyc sync` 同构，但走 Tauri fs 读本地）。
 *
 * 纯函数化 + IO 注入，便于单元测试（测试传 fake io，不碰 Tauri/真实文件系统）。
 */
import type { AssetIndexEntry, AssetType, SyncPost, SyncUploadRequest } from "@hyacine/contract";
import { statFile, readDirRecursive, readTextFile } from "../tauri/bridge";

/** 桌面端本地的 IO 边界，构造 payload 时注入（默认走 Tauri bridge） */
export interface CloudSyncIO {
  readDirRecursive(dir: string): Promise<string[]>;
  readTextFile(path: string): Promise<string | null>;
  statFile(
    path: string,
  ): Promise<{ size: number; mtime: Date | null; birthtime: Date | null } | null>;
}

export const defaultCloudSyncIO: CloudSyncIO = { readDirRecursive, statFile, readTextFile };

type LocalPostLike = {
  path: string; // 相对 contentDir
  title: string;
  slug: string;
  draft: boolean;
  categories: string[];
  hash: string;
};

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif", "svg"]);
const FONT_EXTS = new Set(["ttf", "otf", "woff", "woff2"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "flac"]);

export function classifyAsset(ext: string): AssetType {
  if (IMAGE_EXTS.has(ext)) return "image";
  if (FONT_EXTS.has(ext)) return "font";
  if (VIDEO_EXTS.has(ext)) return "video";
  if (AUDIO_EXTS.has(ext)) return "audio";
  return "other";
}

function stripBase(file: string, base: string): string {
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return file.startsWith(prefix) ? file.slice(prefix.length) : file;
}

async function scanCloudAssets(
  projectRoot: string,
  assetsDir: string,
  io: CloudSyncIO,
): Promise<AssetIndexEntry[]> {
  const abs = `${projectRoot}/${assetsDir}`;
  const files = await io.readDirRecursive(abs);
  const entries: AssetIndexEntry[] = [];
  for (const full of files) {
    const s = await io.statFile(full);
    const ext = full.includes(".") ? (full.split(".").pop() ?? "").toLowerCase() : "";
    // 与 CLI scanAssets 一致：path 相对项目根（如 "src/assets/foo.png"）
    const rel = `${assetsDir}/${stripBase(full, abs)}`;
    entries.push({
      path: rel,
      isRemote: false,
      assetType: classifyAsset(ext),
      fileType: ext || "unknown",
      checksum: null,
      r2Key: null,
      size: s?.size ?? 0,
      updatedAt: (s?.mtime ?? new Date()).toISOString(),
    });
  }
  return entries;
}

/** 把本地 post 索引映射为 SyncPost（content 可选；时间戳 stat mtime，兜底 now） */
async function mapPostIndex(
  projectRoot: string,
  contentDir: string,
  posts: LocalPostLike[],
  io: CloudSyncIO,
): Promise<SyncPost[]> {
  const out: SyncPost[] = [];
  for (const p of posts) {
    const abs = `${projectRoot}/${contentDir}/${p.path}`;
    const s = await io.statFile(abs);
    const now = new Date();
    const updatedAt = s?.mtime ?? now;
    const createdAt = s?.birthtime ?? updatedAt;
    let content: string | undefined;
    try {
      content = (await io.readTextFile(abs)) ?? undefined;
    } catch {
      content = undefined;
    }
    out.push({
      path: p.path,
      slug: p.slug,
      title: p.title,
      draft: p.draft,
      categories: p.categories,
      hash: p.hash,
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      lastModified: updatedAt.toISOString(),
      content,
    });
  }
  return out;
}

export interface BuildCloudSyncArgs {
  projectRoot: string;
  contentDir: string;
  assetsDir: string;
  posts: LocalPostLike[];
}

/** 生成可直接交给 client.syncUpload 的 payload：generatedAt + posts + assets + deletedPaths */
export async function buildCloudSyncPayload(
  args: BuildCloudSyncArgs,
  io: CloudSyncIO = defaultCloudSyncIO,
): Promise<SyncUploadRequest> {
  const [posts, assets] = await Promise.all([
    mapPostIndex(args.projectRoot, args.contentDir, args.posts, io),
    scanCloudAssets(args.projectRoot, args.assetsDir, io),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    posts,
    assets,
    // v1：desktop 不维护“上次上行的 path 集合”，删除推断交给 API 侧 / 后续加本地 state
    deletedPaths: [],
  };
}
