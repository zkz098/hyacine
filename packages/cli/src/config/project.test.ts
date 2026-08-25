import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getCollections } from "@hyacine/contract";
import { loadProjectConfig } from "./project";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "hyacine-config-"));
  dirs.push(d);
  return d;
}

describe("loadProjectConfig + mergeGeneratedCollections", () => {
  it("hyacine.yml 无 collections → 合并 hyacine.collections.json 生效", () => {
    const root = tmp();
    writeFileSync(join(root, "hyacine.yml"), "contentDir: src/posts\n", "utf8");
    writeFileSync(
      join(root, "hyacine.collections.json"),
      JSON.stringify({
        version: 1,
        generatedAt: "2026-01-01T00:00:00.000Z",
        source: "content.config.ts",
        collections: [
          {
            name: "posts",
            dir: "src/posts",
            pattern: null,
            extensions: [".md"],
            contentKind: "content",
            schema: {},
            ui: { fields: [] },
          },
          {
            name: "moments",
            dir: "src/moments",
            pattern: null,
            extensions: [".md"],
            contentKind: "content",
            schema: {},
            ui: { fields: [] },
          },
        ],
        warnings: [],
      }),
      "utf8",
    );
    const cfg = loadProjectConfig(root);
    expect(cfg.collections).toEqual({ posts: "src/posts", moments: "src/moments" });
  });

  it("hyacine.yml 显式 collections 优先于产物", () => {
    const root = tmp();
    writeFileSync(
      join(root, "hyacine.yml"),
      "contentDir: src/posts\ncollections:\n  notes: src/notes\n",
      "utf8",
    );
    writeFileSync(join(root, "hyacine.collections.json"), "{}", "utf8");
    const cfg = loadProjectConfig(root);
    expect(cfg.collections).toEqual({ notes: "src/notes" });
  });

  it("无产物 → 回退单集合（getCollections 缺省 posts→contentDir）", () => {
    const root = tmp();
    writeFileSync(join(root, "hyacine.yml"), "contentDir: src/posts\n", "utf8");
    const cfg = loadProjectConfig(root);
    expect(cfg.collections).toBeUndefined();
    expect(getCollections(cfg)).toEqual([{ name: "posts", dir: "src/posts" }]);
  });
});
