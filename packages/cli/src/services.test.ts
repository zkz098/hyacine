import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanPosts, createPost, findPostByQuery } from "./services/posts";
import { scanAssets, buildSyncPayload, chunkText } from "./services/sync";
import type { ProjectConfig } from "./config/project";

function makeTmpProject(): { root: string; config: ProjectConfig } {
  const root = mkdtempSync(join(tmpdir(), "hyacine-test-"));
  const config: ProjectConfig = {
    contentDir: "src/posts",
    assetsDir: "src/assets",
    postExtension: [".md", ".mdx"],
    themeConfigPath: null,
  };
  mkdirSync(join(root, "src/posts"), { recursive: true });
  mkdirSync(join(root, "src/assets"), { recursive: true });
  writeFileSync(join(root, "hyacine.yml"), "contentDir: src/posts\n", "utf8");
  return { root, config };
}

describe("scanPosts", () => {
  it("extracts index and hash", () => {
    const { root, config } = makeTmpProject();
    writeFileSync(
      join(root, "src/posts", "hello.md"),
      `---\ntitle: Hello\nslug: hello\n---\n\nWorld\n`,
      "utf8",
    );
    const posts = scanPosts(root, config);
    expect(posts).toHaveLength(1);
    expect(posts[0]?.title).toBe("Hello");
    expect(posts[0]?.slug).toBe("hello");
    expect(posts[0]?.hash).toMatch(/^[0-9a-f]{16}$/);
    rmSync(root, { recursive: true, force: true });
  });

  it("createPost and findPostByQuery", () => {
    const { root, config } = makeTmpProject();
    const rel = createPost(root, config, "My Title", ["cat"], true);
    expect(rel).toContain("my-title.md");
    expect(existsSync(join(root, rel))).toBe(true);
    const found = findPostByQuery(root, config, "my-title");
    expect(found).not.toBeNull();
    rmSync(root, { recursive: true, force: true });
  });
});

describe("scanAssets", () => {
  it("classifies assets", () => {
    const { root, config } = makeTmpProject();
    writeFileSync(join(root, "src/assets", "img.png"), "fake", "utf8");
    writeFileSync(join(root, "src/assets", "font.woff2"), "fake", "utf8");
    const assets = scanAssets(root, config);
    expect(assets.length).toBe(2);
    const img = assets.find((a) => a.path.endsWith("img.png"));
    expect(img?.assetType).toBe("image");
    const font = assets.find((a) => a.path.endsWith("font.woff2"));
    expect(font?.assetType).toBe("font");
    rmSync(root, { recursive: true, force: true });
  });
});

describe("buildSyncPayload", () => {
  it("detects deleted paths", () => {
    const { root, config } = makeTmpProject();
    writeFileSync(join(root, "src/posts", "a.md"), `---\ntitle: A\n---\n\nA\n`, "utf8");
    writeFileSync(join(root, "src/posts", "b.md"), `---\ntitle: B\n---\n\nB\n`, "utf8");
    const first = buildSyncPayload(root, config, null);
    expect(first.deletedPaths).toEqual([]);
    const lastPaths = first.posts.map((p) => p.path);
    unlinkSync(join(root, "src/posts", "b.md"));
    const second = buildSyncPayload(root, config, lastPaths);
    expect(second.deletedPaths).toContain("b.md");
    expect(second.posts).toHaveLength(1);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("chunkText", () => {
  it("splits by paragraphs", () => {
    const chunks = chunkText("para1\n\npara2\n\npara3", 100);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.join(" ")).toContain("para1");
  });
  it("respects maxChars and max 256", () => {
    const long = "a".repeat(10000);
    const chunks = chunkText(long, 800);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(800);
    expect(chunks.length).toBeLessThanOrEqual(256);
  });
});
