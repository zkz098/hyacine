import { describe, expect, it } from "vitest";
import { buildCloudSyncPayload, classifyAsset, type CloudSyncIO } from "./syncCloud";

function fakeIo(files: Record<string, { size: number; mtime: string }>): CloudSyncIO {
  const entries = Object.entries(files);
  return {
    async readDirRecursive(dir: string) {
      return entries.filter(([p]) => p.startsWith(`${dir}/`)).map(([p]) => p);
    },
    async readTextFile(path: string) {
      const f = files[path];
      return f === undefined ? null : `---\ntitle: ${path}\n---\nbody`;
    },
    async statFile(path: string) {
      const f = files[path];
      if (f === undefined) return null;
      return { size: f.size, mtime: new Date(f.mtime), birthtime: new Date(f.mtime) };
    },
  };
}

describe("classifyAsset", () => {
  it("识别图片/字体/视频/音频/其他", () => {
    expect(classifyAsset("png")).toBe("image");
    expect(classifyAsset("woff2")).toBe("font");
    expect(classifyAsset("mp4")).toBe("video");
    expect(classifyAsset("ogg")).toBe("audio");
    expect(classifyAsset("bin")).toBe("other");
    expect(classifyAsset("")).toBe("other");
  });
});

describe("buildCloudSyncPayload", () => {
  const io = fakeIo({
    "C:/blog/src/posts/a.md": { size: 100, mtime: "2026-08-01T00:00:00.000Z" },
    "C:/blog/src/posts/sub/b.mdx": { size: 200, mtime: "2026-08-02T00:00:00.000Z" },
    "C:/blog/src/assets/img/logo.png": { size: 500, mtime: "2026-08-03T00:00:00.000Z" },
  });

  it("映射 posts 索引（路径相对 contentDir、时间戳来自 stat）", async () => {
    const payload = await buildCloudSyncPayload(
      {
        projectRoot: "C:/blog",
        contentDir: "src/posts",
        assetsDir: "src/assets",
        posts: [
          {
            path: "a.md",
            title: "A",
            slug: "a",
            draft: false,
            categories: [],
            hash: "aaa",
          },
        ],
      },
      io,
    );
    expect(payload.posts).toHaveLength(1);
    expect(payload.posts[0]).toMatchObject({
      path: "a.md",
      title: "A",
      slug: "a",
      draft: false,
      hash: "aaa",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
    expect(payload.posts[0]?.content).toContain("body");
  });

  it("扫描资产（路径相对项目根、分类正确、大小来自 stat）", async () => {
    const payload = await buildCloudSyncPayload(
      {
        projectRoot: "C:/blog",
        contentDir: "src/posts",
        assetsDir: "src/assets",
        posts: [],
      },
      io,
    );
    expect(payload.assets).toHaveLength(1);
    expect(payload.assets[0]).toMatchObject({
      path: "src/assets/img/logo.png",
      isRemote: false,
      assetType: "image",
      fileType: "png",
      size: 500,
    });
  });

  it("deletedPaths 恒为空数组（v1 不推断删除）", async () => {
    const payload = await buildCloudSyncPayload(
      {
        projectRoot: "C:/blog",
        contentDir: "src/posts",
        assetsDir: "src/assets",
        posts: [],
      },
      io,
    );
    expect(payload.deletedPaths).toEqual([]);
    expect(payload.generatedAt).toEqual(expect.any(String));
  });

  it("stat 缺失时时间戳回退到当前时间", async () => {
    const payload = await buildCloudSyncPayload(
      {
        projectRoot: "C:/blog",
        contentDir: "src/posts",
        assetsDir: "src/assets",
        posts: [
          {
            path: "missing.md",
            title: "M",
            slug: "m",
            draft: true,
            categories: ["x"],
            hash: "bbb",
          },
        ],
      },
      io,
    );
    expect(payload.posts[0]).toMatchObject({ path: "missing.md", draft: true, categories: ["x"] });
    expect(payload.posts[0]?.updatedAt).toEqual(expect.any(String));
  });
});
