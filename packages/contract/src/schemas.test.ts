import { describe, expect, it } from "vitest";
import {
  ApiErrorSchema,
  FrontmatterSchema,
  HashSchema,
  PostIndexEntrySchema,
  PostListItemSchema,
  PostPathSchema,
  PresignRequestSchema,
  ScopeSchema,
  SlugSchema,
  SyncUploadRequestSchema,
  SyncAiNeedSchema,
  type Frontmatter,
  type PostIndexEntry,
} from "./index";

function makePostIndexEntry(overrides: Partial<PostIndexEntry> = {}): PostIndexEntry {
  const now = new Date().toISOString();
  return {
    path: "hello-world.md",
    slug: "hello-world",
    title: "Hello World",
    draft: false,
    categories: ["随笔"],
    hash: "a".repeat(16),
    createdAt: now,
    updatedAt: now,
    lastModified: now,
    ...overrides,
  };
}

describe("common schemas", () => {
  it("hash 只接受十六进制 8~128 位", () => {
    expect(HashSchema.safeParse("a".repeat(16)).success).toBe(true);
    expect(HashSchema.safeParse("xyz").success).toBe(false);
    expect(HashSchema.safeParse("a".repeat(200)).success).toBe(false);
  });

  it("post path 拒绝前导斜杠/点目录/非 md 后缀", () => {
    expect(PostPathSchema.safeParse("posts/hello.md").success).toBe(true);
    expect(PostPathSchema.safeParse("/posts/hello.md").success).toBe(false);
    expect(PostPathSchema.safeParse("posts/../hello.md").success).toBe(false);
    expect(PostPathSchema.safeParse("hello.txt").success).toBe(false);
  });

  it("slug 只接受字母数字连字符（大小写不敏感，拒绝空格）", () => {
    expect(SlugSchema.safeParse("hello-world-2").success).toBe(true);
    expect(SlugSchema.safeParse("Hello").success).toBe(true);
    expect(SlugSchema.safeParse("hello world").success).toBe(false);
    expect(SlugSchema.safeParse("hello_world").success).toBe(false);
  });

  it("scope 枚举固定四值", () => {
    expect(ScopeSchema.safeParse("admin").success).toBe(true);
    expect(ScopeSchema.safeParse("owner").success).toBe(false);
  });

  it("错误信封可解析并携带 details", () => {
    const parsed = ApiErrorSchema.parse({
      error: { code: "unauthorized", message: "token 无效", details: { hint: "login" } },
    });
    expect(parsed.error.code).toBe("unauthorized");
    expect(parsed.error.details).toEqual({ hint: "login" });
  });
});

describe("frontmatter schema", () => {
  it("已知键校验且未知键 passthrough", () => {
    const fm: Frontmatter = FrontmatterSchema.parse({
      title: "Hi",
      draft: true,
      cover: "cover-1.avif", // 主题扩展键
      extra: { nested: true },
    });
    expect(fm.draft).toBe(true);
    expect(fm.cover).toBe("cover-1.avif");
    expect(fm.extra).toEqual({ nested: true });
  });

  it("categories 接受字符串或数组", () => {
    const single = FrontmatterSchema.parse({ categories: "随笔" });
    expect(single.categories).toBe("随笔");
    const many = FrontmatterSchema.parse({ categories: ["a", "b"] });
    expect(Array.isArray(many.categories)).toBe(true);
  });

  it("拒绝非法 slug 与非法 summary hash", () => {
    expect(FrontmatterSchema.safeParse({ slug: "有 空格" }).success).toBe(false);
    expect(FrontmatterSchema.safeParse({ summarySourceHash: "nothex" }).success).toBe(false);
  });
});

describe("post index entry", () => {
  it("合法条目通过", () => {
    const entry = makePostIndexEntry();
    expect(PostIndexEntrySchema.safeParse(entry).success).toBe(true);
  });

  it("非法 slug 拒绝", () => {
    expect(PostIndexEntrySchema.safeParse(makePostIndexEntry({ slug: "BAD slug" })).success).toBe(
      false,
    );
  });

  it("categories 缺省为 []", () => {
    const { categories, ...rest } = makePostIndexEntry();
    expect(categories).toEqual(["随笔"]);
    const parsed = PostIndexEntrySchema.parse(rest);
    expect(parsed.categories).toEqual([]);
  });

  it("列表项带 ai 状态（缺字段拒绝）", () => {
    const entry = makePostIndexEntry();
    const item = {
      ...entry,
      ai: {
        summary: { present: true, model: "m1", at: "2026-01-01T00:00:00.000Z" },
        embed: { present: false, model: null, at: null },
      },
    };
    expect(PostListItemSchema.safeParse(item).success).toBe(true);
    expect(
      PostListItemSchema.safeParse({ ...entry, ai: { summary: { present: true } } }).success,
    ).toBe(false);
  });
});

describe("sync payload", () => {
  it("deletedPaths 缺省为 []", () => {
    const now = new Date().toISOString();
    const parsed = SyncUploadRequestSchema.parse({
      generatedAt: now,
      posts: [makePostIndexEntry()],
      assets: [],
    });
    expect(parsed.deletedPaths).toEqual([]);
    expect(parsed.posts).toHaveLength(1);
  });

  it("sync ai need 的 reason 只允许三种", () => {
    expect(
      SyncAiNeedSchema.safeParse({ hash: "a".repeat(16), path: "x.md", reason: "both" }).success,
    ).toBe(true);
    expect(
      SyncAiNeedSchema.safeParse({ hash: "a".repeat(16), path: "x.md", reason: "images" }).success,
    ).toBe(false);
  });
});

describe("presign request", () => {
  it("key 规约与大小上限", () => {
    expect(
      PresignRequestSchema.safeParse({
        key: "images/cover.webp",
        contentType: "image/webp",
        size: 1024,
      }).success,
    ).toBe(true);
    expect(
      PresignRequestSchema.safeParse({ key: "../escape.png", contentType: "image/png", size: 1 })
        .success,
    ).toBe(false);
    expect(
      PresignRequestSchema.safeParse({
        key: "ok.png",
        contentType: "image/png",
        size: 101 * 1024 * 1024,
      }).success,
    ).toBe(false);
  });
});
