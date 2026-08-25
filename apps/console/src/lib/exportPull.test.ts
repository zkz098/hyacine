import { describe, expect, it } from "vitest";
import { pullExportToLocal, type ExportPullIO } from "./exportPull";
import type { ExportPayload } from "@hyacine/contract";

function fakeIo(): { io: ExportPullIO; files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    files,
    io: {
      async writeTextFile(path: string, content: string) {
        files.set(path, content);
      },
    },
  };
}

describe("pullExportToLocal", () => {
  it("把快照写回本地内容目录（projectRoot/contentDir 拼接）", async () => {
    const { io, files } = fakeIo();
    const snapshot: ExportPayload = {
      generatedAt: "2026-08-25T00:00:00.000Z",
      posts: [
        { path: "a.md", content: "---\ntitle: A\n---\n\nA body" },
        { path: "sub/b.mdx", content: "B body" },
      ],
    };
    const r = await pullExportToLocal("C:/blog", "src/posts", snapshot, io);
    expect(r.written).toBe(2);
    expect(files.get("C:/blog/src/posts/a.md")).toContain("title: A");
    expect(files.get("C:/blog/src/posts/sub/b.mdx")).toBe("B body");
  });

  it("跳过含目录穿越/非法字符的 path", async () => {
    const { io, files } = fakeIo();
    const snapshot: ExportPayload = {
      generatedAt: "2026-08-25T00:00:00.000Z",
      posts: [
        { path: "ok.md", content: "ok" },
        { path: "../evil.md", content: "evil" },
        { path: "no-ext", content: "x" },
        { path: "dir/file.txt", content: "y" },
        { path: "中文/文章.md", content: "中文正文" },
      ],
    };
    const r = await pullExportToLocal("C:/blog", "src/posts", snapshot, io);
    expect(r.written).toBe(2); // ok.md + 中文/文章.md
    expect(r.skipped).toBe(3);
    expect(files.has("C:/blog/src/posts/../evil.md")).toBe(false);
    expect(files.get("C:/blog/src/posts/中文/文章.md")).toBe("中文正文");
  });
});
