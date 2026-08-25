import type { ExportPayload } from "@hyacine/contract";

/**
 * Primary 双向同步的下行侧：把云端全量快照（export）写回本地内容目录，
 * 覆盖本地文件 → 刷新列表。IO 注入便于测试（不碰 Tauri）。
 * snapshot.posts[].path 为 repo 相对路径（src/posts/hello.md、src/moments/foo.md）。
 */
export interface ExportPullIO {
  writeTextFile(path: string, content: string): Promise<void>;
}

// 字符类中 `/` 无须转义（oxlint no-useless-escape）；dot 不允许（防隐藏文件/存名攻击）
const SAFE_POST_PATH = /^[A-Za-z0-9_\-/\p{L}\p{N}]+\.(md|mdx)$/u;

export async function pullExportToLocal(
  projectRoot: string,
  snapshot: ExportPayload,
  io: ExportPullIO,
): Promise<{ written: number; skipped: number }> {
  let written = 0;
  let skipped = 0;
  for (const post of snapshot.posts) {
    // path 安全（防目录穿越）：字符白名单 + 限定扩展名
    if (!SAFE_POST_PATH.test(post.path)) {
      skipped += 1;
      continue;
    }
    const abs = `${projectRoot}/${post.path}`;
    await io.writeTextFile(abs, post.content);
    written += 1;
  }
  return { written, skipped };
}
